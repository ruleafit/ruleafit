-- ============================================================================
-- Ruleafit · 059_fix_funciones_open_a_rulos.sql
-- Corrige un bug real de producción: el registro de usuarios nuevos (por
-- email y por Google) fallaba siempre, detectado el 30 de agosto de 2026 y
-- diagnosticado y corregido el 7 de septiembre de 2026.
--
-- YA EJECUTADO a mano en el SQL Editor de Supabase el 7 de septiembre de
-- 2026 (una función cada vez, por bloqueos del clasificador de seguridad al
-- escribir varias juntas). Este archivo documenta exactamente lo que se
-- ejecutó, para que el repo refleje el estado real de la base de datos.
--
-- Causa raíz: el rename Open -> Rulos del 28 de agosto de 2026 (ver
-- claude/rename-open-a-rulos.md y PROGRESS.md, sección "Rename sistema de
-- puntos Open -> Rulos") renombró las funciones con
-- "ALTER FUNCTION ... RENAME TO ...". Eso cambia el nombre en el catálogo de
-- Postgres, pero NO reescribe el texto interno (el "cuerpo") de la función.
-- Como resultado:
--   - otorgar_rulos() (antes otorgar_open()) seguía escribiendo en
--     public.open_movimientos / public.open_saldos. Esas tablas ya no
--     existen desde el 30 de agosto de 2026, cuando se borraron las vistas
--     de compatibilidad que quedaban con esos nombres apuntando a las tablas
--     reales (rulos_movimientos / rulos_saldos).
--   - otorgar_rulos_bienvenida() (antes otorgar_open_bienvenida()) seguía
--     llamando a "public.otorgar_open(...)", nombre que ya no existe tras el
--     rename de la función anterior.
-- otorgar_rulos_bienvenida() se dispara con un trigger AFTER INSERT en
-- auth.users (bienvenida automática de 20 Rulos al registrarse). Al fallar
-- dentro de ese trigger, se abortaba toda la transacción de alta de usuario
-- -- igual da si el alta es por email/contraseña o por OAuth de Google,
-- las dos crean una fila nueva en auth.users y disparan el mismo trigger.
-- De ahí que ningún usuario nuevo pudiera registrarse por ningún método.
--
-- Se encontraron dos funciones más con el mismo patrón roto por dentro,
-- aunque sin ningún trigger activo hoy que las dispare automáticamente
-- (comprobado con pg_trigger antes de aplicar este archivo):
--   - otorgar_rulos_valoracion(): pensada para conceder Rulos al cliente por
--     valorar a su entrenador. No hay trigger enganchado en public.
--     valoraciones ahora mismo, así que no estaba rompiendo nada en vivo,
--     pero quedaba con el mismo bug listo para reaparecer si se activara.
--   - marcar_asistencia(): sustituida por la asistencia automática de la
--     Tarea A (29 agosto 2026); revocada a "authenticated" así que ningún
--     cliente puede llamarla ya, pero se corrige igualmente por higiene.
--
-- El arreglo es el mismo patrón en las 4: sustituir los nombres viejos
-- (open_movimientos, open_saldos, otorgar_open) por los reales actuales
-- (rulos_movimientos, rulos_saldos, otorgar_rulos). CREATE OR REPLACE
-- FUNCTION no toca triggers, permisos ni comentarios ya existentes sobre
-- cada función, así que no hace falta repetir esos GRANT/REVOKE/COMMENT.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) otorgar_rulos(): ahora escribe en rulos_movimientos / rulos_saldos.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos(
  p_usuario_id      uuid,
  p_cantidad        integer,
  p_motivo          text,
  p_referencia_tipo text default null,
  p_referencia_id   uuid default null,
  p_otorgado_por    uuid default null,
  p_nota            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_movimiento_id uuid;
begin
  if p_cantidad = 0 then
    raise exception 'La cantidad de Rulos no puede ser cero.' using errcode = 'P0001';
  end if;

  insert into public.rulos_movimientos
    (usuario_id, cantidad, motivo, referencia_tipo, referencia_id, otorgado_por, nota)
  values
    (p_usuario_id, p_cantidad, p_motivo, p_referencia_tipo, p_referencia_id, p_otorgado_por, p_nota)
  returning id into v_movimiento_id;

  insert into public.rulos_saldos (usuario_id, saldo, updated_at)
  values (p_usuario_id, p_cantidad, now())
  on conflict (usuario_id) do update
    set saldo = public.rulos_saldos.saldo + excluded.saldo,
        updated_at = now();

  return v_movimiento_id;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 2) otorgar_rulos_bienvenida(): ahora llama a public.otorgar_rulos(...).
--    Trigger on_auth_user_created_otorgar_bienvenida (AFTER INSERT en
--    auth.users) ya apuntaba a esta función por nombre; no hace falta
--    recrear el trigger, solo el cuerpo de la función.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.otorgar_rulos(
    p_usuario_id => new.id,
    p_cantidad   => 20,
    p_motivo     => 'bienvenida'
  );

  return new;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 3) otorgar_rulos_valoracion(): ahora llama a public.otorgar_rulos(...).
--    Sin trigger activo hoy (comprobado en pg_trigger sobre public.
--    valoraciones antes de aplicar este archivo); se deja corregida por si
--    se engancha un trigger en el futuro.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos_valoracion()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.otorgar_rulos(
    p_usuario_id      => new.cliente_id,
    p_cantidad        => 10,
    p_motivo          => 'valoracion_realizada',
    p_referencia_tipo => 'valoracion',
    p_referencia_id   => new.id,
    p_otorgado_por    => null,
    p_nota            => null
  );

  return new;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 4) marcar_asistencia(): mismo arreglo, las dos llamadas internas a
--    otorgar_open(...) pasan a otorgar_rulos(...). Función en desuso desde
--    la Tarea A (sql/057_asistencia_automatica.sql revocó su EXECUTE a
--    authenticated), se corrige solo por higiene/consistencia del código.
-- ----------------------------------------------------------------------------
create or replace function public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario_id    uuid;
  v_reserva       record;
  v_clase         record;
  v_clase_inicio  timestamp;
  v_ahora_local   timestamp;
  v_estado_nuevo  text;
  v_cantidad_open constant integer := 5;
  v_movimiento_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  select id, clase_id, cliente_id, estado, asistencia
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  select id, trainer_id, fecha, hora
    into v_clase
    from public.clases
    where id = v_reserva.clase_id;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes marcar asistencia en tus propias clases.' using errcode = '42501';
  end if;

  if v_reserva.estado <> 'activa' then
    raise exception 'No se puede marcar asistencia de una reserva cancelada.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio > v_ahora_local then
    raise exception 'No se puede marcar asistencia antes de que empiece la clase.' using errcode = 'P0001';
  end if;

  v_estado_nuevo := case when p_asistio then 'asistio' else 'no_asistio' end;

  if v_reserva.asistencia = v_estado_nuevo then
    raise exception 'La asistencia ya está marcada así.' using errcode = 'P0001';
  end if;

  update public.reservas
    set asistencia = v_estado_nuevo,
        asistencia_marcada_en = now(),
        asistencia_marcada_por = v_usuario_id
    where id = p_reserva_id;

  if v_estado_nuevo = 'asistio' then
    v_movimiento_id := public.otorgar_rulos(
      p_usuario_id      => v_reserva.cliente_id,
      p_cantidad        => v_cantidad_open,
      p_motivo          => 'asistencia_confirmada',
      p_referencia_tipo => 'reserva',
      p_referencia_id   => p_reserva_id,
      p_otorgado_por    => v_usuario_id,
      p_nota            => case
                              when v_reserva.asistencia = 'no_asistio'
                                then 'Corrección: no_asistio -> asistio'
                              else null
                            end
    );
  elsif v_reserva.asistencia = 'asistio' then
    v_movimiento_id := public.otorgar_rulos(
      p_usuario_id      => v_reserva.cliente_id,
      p_cantidad        => -v_cantidad_open,
      p_motivo          => 'asistencia_confirmada',
      p_referencia_tipo => 'reserva',
      p_referencia_id   => p_reserva_id,
      p_otorgado_por    => v_usuario_id,
      p_nota            => 'Corrección: asistio -> no_asistio'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'reserva_id', p_reserva_id,
    'asistencia', v_estado_nuevo,
    'movimiento_id', v_movimiento_id
  );
end;
$function$;
