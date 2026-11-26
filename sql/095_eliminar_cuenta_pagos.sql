-- ============================================================================
-- Ruleafit · 095_eliminar_cuenta_pagos.sql
-- eliminar_mi_cuenta() con las tablas de pagos (sql/071-073).
--
-- Decisión (opción A, a validar con el asesor fiscal):
--  * Se RECHAZA el borrado si hay dinero en movimiento: cobros 'creado' (últimas
--    24 h) o 'requiere_reembolso', saldo en la bolsa distinto de 0, líneas de
--    liquidación pendientes, o cobros pagados como alumno de sesiones futuras.
--  * Si no hay nada pendiente, los registros contables (cobros, bolsas,
--    movimientos_bolsa, liquidaciones_lineas) se CONSERVAN sin vínculo FK con
--    auth.users: queda solo el uuid (seudónimo), sin datos personales.
--  * El perfil fiscal se ANONIMIZA: se copia a archivo_fiscal solo lo mínimo
--    (tipo, tipo de documento, NIF, zona fiscal, versiones aceptadas y fechas) y
--    se borra la fila con nombre, dirección, correo, IBAN y fecha de nacimiento.
--    Plazo de conservación: a fijar por el asesor (referencia: 6 años).
--
-- Con config_pagos.pagos_activos=false no hay filas de pagos: el comportamiento
-- visible no cambia. Reversión: 095_eliminar_cuenta_pagos_reversion.sql.
-- ============================================================================

-- 1) Archivo fiscal mínimo (sin datos de contacto ni bancarios)
create table if not exists public.archivo_fiscal (
  id                         uuid primary key default gen_random_uuid(),
  usuario_id                 uuid not null,            -- uuid seudónimo, SIN FK
  tipo                       text,
  tipo_documento             text,
  nif                        text,
  zona_fiscal                text,
  acepta_terminos_version    text,
  acepta_autofactura_version text,
  aceptado_en                timestamptz,
  alta_original              timestamptz,
  archivado_en               timestamptz not null default now(),
  conservar_hasta            date not null default ((now() + interval '6 years')::date)
);
create index if not exists archivo_fiscal_usuario_idx on public.archivo_fiscal (usuario_id);
alter table public.archivo_fiscal enable row level security;
revoke all on public.archivo_fiscal from anon, authenticated;   -- solo servicio

-- 2) Quitar las FK a auth.users de las tablas contables (se conserva el uuid)
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and ((c.conrelid = 'public.bolsas'::regclass and a.attname = 'entrenador_id')
         or (c.conrelid = 'public.movimientos_bolsa'::regclass and a.attname = 'entrenador_id')
         or (c.conrelid = 'public.liquidaciones_lineas'::regclass and a.attname = 'entrenador_id')
         or (c.conrelid = 'public.cobros'::regclass and a.attname in ('cliente_id', 'entrenador_id')))
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end;
$$;

-- 3) eliminar_mi_cuenta() con comprobaciones y anonimización de pagos
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
