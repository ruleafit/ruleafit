-- ============================================================================
-- Ruleafit · 072_pagos_funciones.sql
-- Pagos, fase 1 (paso 5): funciones de base de datos. Requiere sql/071.
-- NO activa los pagos: config_pagos.pagos_activos sigue en false y crear_cobro()
-- lo rechaza mientras tanto.
--
-- Funciones:
--   guardar_perfil_fiscal(...)   solo servicio (la llama el servidor tras validar)
--   crear_cobro(...)             usuario autenticado (alumno)
--   confirmar_cobro_pagado(...)  solo servicio (webhook del banco). Idempotente.
--   liberar_pendientes()         solo servicio / pg_cron cada 15 minutos
--
-- Clave del IBAN: se crea aquí en Supabase Vault con un valor aleatorio que
-- nadie ve (solo si no existe). Las funciones la leen desde dentro; el IBAN
-- completo nunca vuelve al navegador. Importante: la clave vive en Vault; si
-- un día se restaura la base de datos en otro proyecto hay que llevarla también.
--
-- Pendiente para antes de activar pagos (ver docs/plan-pagos-fase-1.md):
--   · eliminar_mi_cuenta() debe comprobar bolsa, cobros y perfil fiscal.
--   · cancelar_clase() / cancelar_reserva() aún no generan reembolsos; liberar_
--     pendientes() ignora las clases canceladas para que no se liberen por error.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) Clave de cifrado del IBAN en Vault (valor aleatorio, no visible)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'iban_clave') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'iban_clave',
      'Clave para cifrar los IBAN de los entrenadores (perfiles_fiscales)'
    );
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) guardar_perfil_fiscal: solo servicio
--    El servidor valida antes NIF/IBAN/código postal con lib/pagos/validaciones.
--    p_iban null = conservar el IBAN que ya hay (al editar otros datos).
-- ----------------------------------------------------------------------------
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

  -- Estado: un perfil nuevo pasa a revisión; uno activo vuelve a revisión si
  -- cambia el NIF o el IBAN; uno bloqueado sigue bloqueado.
  if v_actual.usuario_id is null then
    v_estado := 'pendiente_revision';
  elsif v_actual.estado = 'bloqueado' then
    v_estado := 'bloqueado';
  elsif v_actual.nif is distinct from upper(p_nif)
     or v_actual.iban_ultimos4 is distinct from v_ultimos4
     or v_actual.iban_cifrado is distinct from v_cifrado then
    v_estado := 'pendiente_revision';
  else
    v_estado := v_actual.estado;
  end if;

  insert into public.perfiles_fiscales (
    usuario_id, tipo, nombre_fiscal, tipo_documento, nif, direccion, codigo_postal,
    municipio, provincia, zona_fiscal, email_facturas, titular_iban, iban_cifrado,
    iban_ultimos4, fecha_nacimiento, retencion_reducida, acepta_terminos_version,
    acepta_autofactura_version, declara_ingresos, responsable_datos, aceptado_en,
    aceptado_ip, estado
  ) values (
    p_usuario_id, p_tipo, btrim(p_nombre_fiscal), p_tipo_documento, upper(p_nif),
    btrim(p_direccion), btrim(p_codigo_postal), btrim(p_municipio), btrim(p_provincia),
    p_zona_fiscal, btrim(p_email_facturas), btrim(p_titular_iban), v_cifrado,
    v_ultimos4, p_fecha_nacimiento, coalesce(p_retencion_reducida, false),
    p_acepta_terminos_version, p_acepta_autofactura_version, true, true, now(),
    p_ip, v_estado
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
    estado = excluded.estado;

  return jsonb_build_object('ok', true, 'estado', v_estado, 'iban_ultimos4', v_ultimos4);
exception
  when unique_violation then
    raise exception 'Ese documento fiscal ya está registrado en otra cuenta.' using errcode = 'P0001';
end;
$$;

revoke all on function public.guardar_perfil_fiscal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text, text, boolean, boolean, inet) from public, anon, authenticated;
grant execute on function public.guardar_perfil_fiscal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text, text, boolean, boolean, inet) to service_role;


-- ----------------------------------------------------------------------------
-- 3) crear_cobro: el alumno autenticado inicia el pago de una sesión
--    Las mismas comprobaciones que reservar_clase, más: pagos activos, sesión
--    de pago y entrenador con perfil fiscal no bloqueado. No reserva nada:
--    la plaza se concede cuando el banco confirma el pago.
-- ----------------------------------------------------------------------------
create or replace function public.crear_cobro(
  p_clase_id uuid,
  p_pedido   text,
  p_metodo   text default 'tarjeta'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_cfg        public.config_pagos%rowtype;
  v_clase      record;
  v_importe    integer;
  v_comision   integer;
  v_cobro_id   uuid;
begin
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para pagar.' using errcode = '28000';
  end if;
  if p_metodo not in ('tarjeta', 'bizum') then
    raise exception 'Método de pago no válido.' using errcode = 'P0001';
  end if;

  select * into v_cfg from public.config_pagos where id;
  if not found or not v_cfg.pagos_activos then
    raise exception 'Los pagos online no están activados todavía.' using errcode = 'P0001';
  end if;

  select id, trainer_id, titulo, estado, fecha, hora, plazas_max, plazas_ocupadas, precio
    into v_clase
    from public.clases
   where id = p_clase_id;
  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;
  if v_clase.trainer_id = v_usuario_id then
    raise exception 'No puedes reservar tu propia sesión.' using errcode = '42501';
  end if;
  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;
  if (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp < (now() at time zone 'Europe/Madrid') then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;
  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.reservas
     where clase_id = p_clase_id and cliente_id = v_usuario_id and estado = 'activa'
  ) then
    raise exception 'Ya tienes una reserva activa para esta clase.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.bloqueos
     where bloqueador_id = v_clase.trainer_id and bloqueado_id = v_usuario_id
  ) then
    raise exception 'Esta sesión no está disponible para ti.' using errcode = 'P0001';
  end if;

  v_importe := round(coalesce(v_clase.precio, 0) * 100)::integer;
  if v_importe <= 0 then
    raise exception 'Esta sesión es gratuita: no requiere pago.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.perfiles_fiscales
     where usuario_id = v_clase.trainer_id and estado in ('pendiente_revision', 'activo')
  ) then
    raise exception 'El entrenador aún no puede recibir pagos.' using errcode = 'P0001';
  end if;

  -- Comisión en puntos básicos, redondeo al céntimo más cercano (mitad hacia arriba).
  v_comision := floor((v_importe::numeric * v_cfg.comision_bps + 5000) / 10000)::integer;

  insert into public.cobros (
    clase_id, clase_titulo, cliente_id, entrenador_id, importe_centimos,
    comision_bps, comision_centimos, neto_centimos, metodo, pedido_redsys
  ) values (
    v_clase.id, v_clase.titulo, v_usuario_id, v_clase.trainer_id, v_importe,
    v_cfg.comision_bps, v_comision, v_importe - v_comision, p_metodo, p_pedido
  )
  returning id into v_cobro_id;

  return jsonb_build_object(
    'ok', true,
    'cobro_id', v_cobro_id,
    'pedido', p_pedido,
    'importe_centimos', v_importe
  );
end;
$$;

revoke all on function public.crear_cobro(uuid, text, text) from public, anon;
grant execute on function public.crear_cobro(uuid, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 4) confirmar_cobro_pagado: solo servicio (la llama el webhook ya verificado)
--    Idempotente: si el banco avisa dos veces, la segunda no hace nada.
--    Resultado en 'resultado': pagado | fallido | requiere_reembolso |
--    ya_procesado | desconocido | importe_no_coincide.
-- ----------------------------------------------------------------------------
create or replace function public.confirmar_cobro_pagado(
  p_pedido               text,
  p_importe_centimos     integer,
  p_autorizado           boolean,
  p_codigo_respuesta     text default null,
  p_codigo_autorizacion  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro      public.cobros%rowtype;
  v_clase      record;
  v_reserva_id uuid;
  v_hay_plaza  boolean := false;
begin
  select * into v_cobro from public.cobros where pedido_redsys = p_pedido for update;
  if not found then
    return jsonb_build_object('ok', false, 'resultado', 'desconocido');
  end if;
  if v_cobro.estado <> 'creado' then
    return jsonb_build_object('ok', true, 'resultado', 'ya_procesado', 'estado', v_cobro.estado);
  end if;

  if not coalesce(p_autorizado, false) then
    update public.cobros
       set estado = 'fallido', codigo_respuesta = p_codigo_respuesta
     where id = v_cobro.id;
    return jsonb_build_object('ok', true, 'resultado', 'fallido');
  end if;

  -- El importe que confirma el banco debe ser exactamente el del cobro.
  if p_importe_centimos is distinct from v_cobro.importe_centimos then
    return jsonb_build_object('ok', false, 'resultado', 'importe_no_coincide');
  end if;

  -- Intentar dar la plaza. Cualquier fallo (clase llena, cancelada, bloqueo
  -- nuevo...) deja el cobro en requiere_reembolso, sin abonar nada al entrenador.
  begin
    select id, estado, fecha, hora, plazas_max, plazas_ocupadas
      into v_clase
      from public.clases
     where id = v_cobro.clase_id
       for update;

    if found
       and v_clase.estado = 'activa'
       and (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp >= (now() at time zone 'Europe/Madrid')
       and v_clase.plazas_ocupadas < v_clase.plazas_max
       and not exists (
         select 1 from public.reservas
          where clase_id = v_cobro.clase_id and cliente_id = v_cobro.cliente_id and estado = 'activa'
       )
    then
      insert into public.reservas (clase_id, cliente_id)
      values (v_cobro.clase_id, v_cobro.cliente_id)
      returning id into v_reserva_id;

      update public.clases
         set plazas_ocupadas = plazas_ocupadas + 1
       where id = v_cobro.clase_id;

      v_hay_plaza := true;
    end if;
  exception when others then
    v_hay_plaza := false;
    v_reserva_id := null;
  end;

  if not v_hay_plaza then
    update public.cobros
       set estado = 'requiere_reembolso', pagado_en = now(),
           codigo_respuesta = p_codigo_respuesta, codigo_autorizacion = p_codigo_autorizacion
     where id = v_cobro.id;
    return jsonb_build_object('ok', true, 'resultado', 'requiere_reembolso');
  end if;

  update public.cobros
     set estado = 'pagado', pagado_en = now(), reserva_id = v_reserva_id,
         codigo_respuesta = p_codigo_respuesta, codigo_autorizacion = p_codigo_autorizacion
   where id = v_cobro.id;

  insert into public.bolsas (entrenador_id, pendiente_centimos)
  values (v_cobro.entrenador_id, v_cobro.neto_centimos)
  on conflict (entrenador_id) do update
    set pendiente_centimos = public.bolsas.pendiente_centimos + excluded.pendiente_centimos;

  insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
  values (v_cobro.entrenador_id, v_cobro.id, 'abono_pendiente', 'pendiente',
          v_cobro.neto_centimos, 'Cobro de ' || coalesce(v_cobro.clase_titulo, 'sesión'));

  return jsonb_build_object('ok', true, 'resultado', 'pagado', 'reserva_id', v_reserva_id);
end;
$$;

revoke all on function public.confirmar_cobro_pagado(text, integer, boolean, text, text) from public, anon, authenticated;
grant execute on function public.confirmar_cobro_pagado(text, integer, boolean, text, text) to service_role;


-- ----------------------------------------------------------------------------
-- 5) liberar_pendientes: pasa de pendiente a disponible el neto de los cobros
--    cuya sesión terminó hace horas_liberacion horas o más. Se ignoran las
--    sesiones canceladas (esas necesitan reembolso, fase 2).
-- ----------------------------------------------------------------------------
create or replace function public.liberar_pendientes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horas  integer;
  v_cobro  record;
  v_total  integer := 0;
begin
  select horas_liberacion into v_horas from public.config_pagos where id;
  if v_horas is null then
    return 0;
  end if;

  for v_cobro in
    select c.id, c.entrenador_id, c.neto_centimos
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.estado = 'pagado'
       and c.liberado_en is null
       and coalesce(cl.estado, 'activa') <> 'cancelada'
       and (
         case when cl.id is not null
              then ((cl.fecha::text || ' ' || cl.hora::text)::timestamp
                    + make_interval(mins => coalesce(cl.duracion, 60))) at time zone 'Europe/Madrid'
              else c.pagado_en
         end
       ) + make_interval(hours => v_horas) <= now()
     order by c.pagado_en
       for update of c skip locked
  loop
    insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
    values (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'pendiente', -v_cobro.neto_centimos, 'Liberación tras la sesión'),
           (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'disponible', v_cobro.neto_centimos, 'Liberación tras la sesión');

    update public.bolsas
       set pendiente_centimos = pendiente_centimos - v_cobro.neto_centimos,
           disponible_centimos = disponible_centimos + v_cobro.neto_centimos
     where entrenador_id = v_cobro.entrenador_id;

    update public.cobros set liberado_en = now() where id = v_cobro.id;
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.liberar_pendientes() from public, anon, authenticated;
grant execute on function public.liberar_pendientes() to service_role;

-- Cada 15 minutos. cron.schedule con el mismo nombre actualiza el trabajo.
select cron.schedule(
  'liberar-pendientes-pagos',
  '*/15 * * * *',
  $$select public.liberar_pendientes()$$
);


-- ----------------------------------------------------------------------------
-- Comprobación posterior (solo lectura):
--   select proname from pg_proc where proname in
--     ('guardar_perfil_fiscal','crear_cobro','confirmar_cobro_pagado','liberar_pendientes');
--   select name from vault.secrets where name = 'iban_clave';   -- 1 fila (sin ver el valor)
--   select jobname, schedule from cron.job where jobname = 'liberar-pendientes-pagos';
--   select public.liberar_pendientes();   -- debe devolver 0
-- ----------------------------------------------------------------------------
