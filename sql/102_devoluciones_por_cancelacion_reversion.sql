-- Reversión de 102: quita los dos triggers y restaura eliminar_mi_cuenta (095) y guardar_perfil_fiscal (101).
-- No deshace los cobros ya marcados 'requiere_reembolso' (se les debe el dinero).
drop trigger if exists trg_devoluciones_sesion_cancelada on public.clases;
drop function if exists public.marcar_devoluciones_sesion_cancelada();
drop trigger if exists trg_exigir_perfil_fiscal_aprobado on public.cobros;
drop function if exists public.exigir_perfil_fiscal_aprobado();

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_ahora   timestamp := (now() at time zone 'Europe/Madrid');
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  if exists (
    select 1
      from public.clases c
      join public.reservas r on r.clase_id = c.id
      where c.trainer_id = v_usuario
        and c.estado = 'activa'
        and r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp > v_ahora
  ) then
    raise exception 'Tienes sesiones próximas con reservas. Cancélalas antes de eliminar tu cuenta.'
      using errcode = 'P0001';
  end if;

  -- Pagos: no se borra con dinero pendiente.
  if exists (
    select 1 from public.cobros
     where (cliente_id = v_usuario or entrenador_id = v_usuario)
       and (estado = 'requiere_reembolso'
            or (estado = 'creado' and created_at > now() - interval '24 hours'))
  ) then
    raise exception 'Tienes pagos o reembolsos pendientes de tramitar. Escríbenos desde Ayuda y los resolvemos antes de eliminar tu cuenta.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bolsas
     where entrenador_id = v_usuario
       and (pendiente_centimos <> 0 or disponible_centimos <> 0)
  ) or exists (
    select 1 from public.liquidaciones_lineas
     where entrenador_id = v_usuario and estado = 'pendiente'
  ) then
    raise exception 'Tienes saldo o una liquidación pendiente de cobro. Escríbenos desde Ayuda para cerrarlo antes de eliminar tu cuenta.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.cobros co
      join public.clases c on c.id = co.clase_id
     where co.cliente_id = v_usuario
       and co.estado = 'pagado'
       and c.estado = 'activa'
       and (c.fecha::text || ' ' || c.hora::text)::timestamp > v_ahora
  ) then
    raise exception 'Tienes sesiones pagadas que aún no se han celebrado. Cancela la reserva (o espera a que termine) antes de eliminar tu cuenta.'
      using errcode = 'P0001';
  end if;

  update public.clases c
     set plazas_ocupadas = greatest(c.plazas_ocupadas - 1, 0)
    from public.reservas r
   where r.clase_id = c.id
     and r.cliente_id = v_usuario
     and r.estado = 'activa'
     and c.estado = 'activa';

  update public.rulos_movimientos set otorgado_por = null where otorgado_por = v_usuario;
  update public.reservas set asistencia_marcada_por = null where asistencia_marcada_por = v_usuario;

  -- Perfil fiscal: se archiva lo mínimo y se borra el resto (datos personales y bancarios).
  insert into public.archivo_fiscal (
    usuario_id, tipo, tipo_documento, nif, zona_fiscal,
    acepta_terminos_version, acepta_autofactura_version, aceptado_en, alta_original
  )
  select usuario_id, tipo, tipo_documento, nif, zona_fiscal,
         acepta_terminos_version, acepta_autofactura_version, aceptado_en, created_at
    from public.perfiles_fiscales
   where usuario_id = v_usuario;
  delete from public.perfiles_fiscales where usuario_id = v_usuario;

  delete from auth.users where id = v_usuario;
end;
$$;

comment on function public.eliminar_mi_cuenta() is
  'Borra la cuenta del usuario autenticado y sus datos (cascada). Rechaza si hay sesiones proximas con reservas, o dinero pendiente (cobros, saldo, liquidaciones). Conserva los registros contables sin vinculo con la cuenta y anonimiza el perfil fiscal (archivo_fiscal). SECURITY DEFINER: solo opera sobre auth.uid().';

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

create or replace function public.guardar_perfil_fiscal(
  p_usuario_id                 uuid,
  p_tipo                       text,
  p_nombre_fiscal              text,
  p_tipo_documento             text,
  p_nif                        text,
  p_direccion                  text,
  p_codigo_postal              text,
  p_municipio                  text,
  p_provincia                  text,
  p_zona_fiscal                text,
  p_email_facturas             text,
  p_titular_iban               text,
  p_iban                       text,
  p_fecha_nacimiento           date,
  p_retencion_reducida         boolean,
  p_acepta_terminos_version    text,
  p_acepta_autofactura_version text,
  p_declara_ingresos           boolean,
  p_responsable_datos          boolean,
  p_ip                         inet default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave     text;
  v_iban      text;
  v_actual    public.perfiles_fiscales%rowtype;
  v_cifrado   bytea;
  v_ultimos4  text;
  v_estado    text;
begin
  if p_usuario_id is null or not exists (select 1 from auth.users where id = p_usuario_id) then
    raise exception 'Usuario no válido.' using errcode = 'P0002';
  end if;
  if not coalesce(p_declara_ingresos, false) or not coalesce(p_responsable_datos, false) then
    raise exception 'Debes aceptar las declaraciones de responsabilidad.' using errcode = 'P0001';
  end if;

  select * into v_actual from public.perfiles_fiscales where usuario_id = p_usuario_id for update;

  v_cifrado  := v_actual.iban_cifrado;
  v_ultimos4 := v_actual.iban_ultimos4;

  if p_iban is not null and btrim(p_iban) <> '' then
    v_iban := upper(regexp_replace(p_iban, '\s', '', 'g'));
    if v_iban !~ '^ES[0-9]{22}$' then
      raise exception 'IBAN no válido.' using errcode = 'P0001';
    end if;
    select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'iban_clave';
    if v_clave is null then
      raise exception 'Falta la clave de cifrado del IBAN.' using errcode = 'P0001';
    end if;
    v_cifrado  := extensions.pgp_sym_encrypt(v_iban, v_clave);
    v_ultimos4 := right(v_iban, 4);
  elsif v_cifrado is null then
    raise exception 'El IBAN es obligatorio.' using errcode = 'P0001';
  end if;

  -- Estado (sql/101): evaluación automática. El servidor solo llama aquí con datos que han superado
  -- lib/pagos/evaluarPerfilFiscal.ts, así que quedan aprobados al instante. Un perfil bloqueado a mano sigue bloqueado.
  v_estado := case when v_actual.estado = 'bloqueado' then 'bloqueado' else 'activo' end;

  insert into public.perfiles_fiscales (
    usuario_id, tipo, nombre_fiscal, tipo_documento, nif, direccion, codigo_postal,
    municipio, provincia, zona_fiscal, email_facturas, titular_iban, iban_cifrado,
    iban_ultimos4, fecha_nacimiento, retencion_reducida, acepta_terminos_version,
    acepta_autofactura_version, declara_ingresos, responsable_datos, aceptado_en,
    aceptado_ip, estado, revisado_en
  ) values (
    p_usuario_id, p_tipo, btrim(p_nombre_fiscal), p_tipo_documento, upper(p_nif),
    btrim(p_direccion), btrim(p_codigo_postal), btrim(p_municipio), btrim(p_provincia),
    p_zona_fiscal, btrim(p_email_facturas), btrim(p_titular_iban), v_cifrado,
    v_ultimos4, p_fecha_nacimiento, coalesce(p_retencion_reducida, false),
    p_acepta_terminos_version, p_acepta_autofactura_version, true, true, now(),
    p_ip, v_estado, case when v_estado = 'activo' then now() end
  )
  on conflict (usuario_id) do update set
    tipo = excluded.tipo,
    nombre_fiscal = excluded.nombre_fiscal,
    tipo_documento = excluded.tipo_documento,
    nif = excluded.nif,
    direccion = excluded.direccion,
    codigo_postal = excluded.codigo_postal,
    municipio = excluded.municipio,
    provincia = excluded.provincia,
    zona_fiscal = excluded.zona_fiscal,
    email_facturas = excluded.email_facturas,
    titular_iban = excluded.titular_iban,
    iban_cifrado = excluded.iban_cifrado,
    iban_ultimos4 = excluded.iban_ultimos4,
    fecha_nacimiento = excluded.fecha_nacimiento,
    retencion_reducida = excluded.retencion_reducida,
    acepta_terminos_version = excluded.acepta_terminos_version,
    acepta_autofactura_version = excluded.acepta_autofactura_version,
    declara_ingresos = true,
    responsable_datos = true,
    aceptado_en = excluded.aceptado_en,
    aceptado_ip = excluded.aceptado_ip,
    estado = excluded.estado,
    revisado_en = coalesce(excluded.revisado_en, public.perfiles_fiscales.revisado_en),
    revisado_por = case when excluded.estado = 'activo' then null else public.perfiles_fiscales.revisado_por end;

  return jsonb_build_object('ok', true, 'estado', v_estado, 'iban_ultimos4', v_ultimos4);
exception
  when unique_violation then
    raise exception 'Ese documento fiscal ya está registrado en otra cuenta.' using errcode = 'P0001';
end;
$$;

revoke all on function public.guardar_perfil_fiscal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text, text, boolean, boolean, inet) from public, anon, authenticated;
grant execute on function public.guardar_perfil_fiscal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text, text, boolean, boolean, inet) to service_role;
