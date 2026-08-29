-- ============================================================================
-- Ruleafit · 008_aviso_cancelacion_entrenador.sql
-- Permite al cliente distinguir si una reserva se canceló porque él mismo la
-- canceló, o porque el entrenador canceló la clase entera.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tabla public.reservas), sql/003_cancelaciones.sql
-- (función cancelar_reserva) y sql/007_minimo_y_cancelar_clase.sql (función
-- cancelar_clase).
--
-- Nota: no se necesita ninguna política RLS nueva. La política "clientes ven
-- sus propias reservas" (sql/001_reservas.sql) usa "cliente_id = auth.uid()"
-- sin filtrar por estado, así que el cliente ya puede leer sus propias
-- reservas canceladas (y esta columna nueva) sin cambios adicionales.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Columna public.reservas.cancelada_por_entrenador
--    NOT NULL DEFAULT false: todas las reservas existentes (y cualquier
--    reserva nueva) quedan en false salvo que cancelar_clase() la marque
--    explícitamente al cancelar en bloque.
-- ----------------------------------------------------------------------------
alter table public.reservas
  add column cancelada_por_entrenador boolean not null default false;

comment on column public.reservas.cancelada_por_entrenador is
  'true si esta reserva se canceló porque el entrenador canceló la clase entera (cancelar_clase); false si se canceló por el propio cliente (cancelar_reserva) o si sigue activa. Permite a la interfaz avisar al cliente solo cuando la cancelación no fue decisión suya.';


-- ----------------------------------------------------------------------------
-- 2) cancelar_clase(): al cancelar en bloque las reservas activas de la
--    clase, marca también cancelada_por_entrenador = true en esas filas.
--    Resto de la función sin cambios respecto a sql/007_minimo_y_cancelar_clase.sql.
-- ----------------------------------------------------------------------------
create or replace function public.cancelar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id           uuid;
  v_clase                record;
  v_clase_inicio         timestamp;
  v_ahora_local          timestamp;
  v_reservas_canceladas  integer;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar una clase.' using errcode = '28000';
  end if;

  -- 2. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, igual que reservar_clase/cancelar_reserva.
  select id, trainer_id, estado, fecha, hora
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 3. La clase debe pertenecer al entrenador autenticado. Esta es la única
  --    comprobación que importa para que nadie pueda cancelar (ni ver el
  --    resultado de intentarlo sobre) una clase ajena: da igual qué
  --    p_clase_id se pase, si su trainer_id no coincide con auth.uid() la
  --    función rechaza antes de escribir nada, mismo patrón que
  --    marcar_asistencia() y reservas_de_mis_clases().
  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes cancelar tus propias clases.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_clase.estado <> 'activa' then
    raise exception 'Esta clase ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. No se puede cancelar una clase que ya ha empezado o ha pasado (mismo
  --    criterio de fecha+hora exacta en hora local de España que usan
  --    reservar_clase/cancelar_reserva/marcar_asistencia).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 6. Marcar la clase como cancelada.
  update public.clases
    set estado = 'cancelada'
    where id = p_clase_id;

  -- 7. Marcar como canceladas, de golpe, todas las reservas activas de esta
  --    clase (mismo campo cancelled_at que usa cancelar_reserva() para una
  --    reserva individual), y cancelada_por_entrenador = true para que el
  --    cliente pueda distinguir esta cancelación de una hecha por él mismo
  --    (cancelar_reserva() no toca esta columna, se queda en false).
  --    GET DIAGNOSTICS recoge cuántas filas afectó el UPDATE para poder
  --    informar al entrenador.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now(),
        cancelada_por_entrenador = true
    where clase_id = p_clase_id
      and estado = 'activa';

  get diagnostics v_reservas_canceladas = row_count;

  -- 8. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'clase_id', p_clase_id,
    'reservas_canceladas', v_reservas_canceladas
  );
end;
$$;

comment on function public.cancelar_clase(uuid) is
  'Cancela una clase entera del entrenador autenticado de forma atómica: valida propiedad de la clase (trainer_id = auth.uid()), que no esté ya cancelada y que no haya empezado, bloquea la fila de la clase para evitar condiciones de carrera, marca la clase como cancelada y cancela de golpe todas las reservas activas asociadas marcándolas con cancelada_por_entrenador = true (para que el cliente distinga esta cancelación de una hecha por él mismo), sin cargo ni devolución real todavía. Devuelve cuántas reservas se cancelaron.';

-- Permisos de ejecución sin cambios respecto a sql/007_minimo_y_cancelar_clase.sql
-- (ya concedidos a authenticated); CREATE OR REPLACE no los toca ni los
-- borra, así que no hace falta repetir el revoke/grant.
