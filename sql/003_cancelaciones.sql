-- ============================================================================
-- Ruleafit · 003_cancelaciones.sql
-- Cancelación de reservas por parte del cliente, con cálculo del umbral de 2h
-- (sin cargo ni devolución real todavía: la cartera no existe aún, ver
-- CLAUDE.md "Decisiones de producto (MVP)").
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tabla public.reservas, tabla public.clases,
-- función reservar_clase ya creadas y ejecutadas).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función RPC cancelar_reserva(p_reserva_id uuid)
--    Hace todas las comprobaciones y la escritura en una sola transacción
--    implícita: si cualquier "raise exception" salta, Postgres deshace
--    automáticamente todo lo que la función haya hecho hasta ese punto (nada
--    de reservas canceladas a medias ni contadores de plazas descuadrados).
-- ----------------------------------------------------------------------------
create or replace function public.cancelar_reserva(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id          uuid;
  v_reserva              record;
  v_clase                record;
  v_clase_inicio         timestamp;
  v_ahora_local          timestamp;
  v_reembolso_aplicable  boolean;
  v_plazas_ocupadas      integer;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar.' using errcode = '28000';
  end if;

  -- 2. La reserva debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, igual que reservar_clase hace con la clase.
  select id, clase_id, cliente_id, estado
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  -- 3. La reserva debe pertenecer al usuario autenticado. Esta es la única
  --    comprobación que importa para que nadie pueda cancelar una reserva
  --    ajena: da igual qué id de reserva se pase, si su cliente_id no
  --    coincide con auth.uid() la función rechaza antes de escribir nada.
  if v_reserva.cliente_id <> v_usuario_id then
    raise exception 'No puedes cancelar una reserva que no es tuya.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_reserva.estado <> 'activa' then
    raise exception 'Esta reserva ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. La clase asociada debe existir. Se bloquea también su fila porque
  --    esta función va a decrementar plazas_ocupadas más abajo.
  select id, estado, fecha, hora, plazas_ocupadas
    into v_clase
    from public.clases
    where id = v_reserva.clase_id
    for update;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  -- 6. No se puede cancelar una clase que ya ha empezado o ha pasado (mismo
  --    criterio de fecha+hora exacta en hora local de España que usa
  --    reservar_clase, ver sql/001_reservas.sql).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 7. ¿Quedaban 2 horas o más hasta el inicio de la clase en el momento de
  --    cancelar? Se calcula y se devuelve para que la interfaz informe al
  --    cliente, pero de momento no dispara ningún cargo ni devolución real
  --    (la cartera todavía no existe, ver Fase 4 en PROGRESS.md).
  v_reembolso_aplicable := (v_clase_inicio - v_ahora_local) >= interval '2 hours';

  -- 8. Cancelar la reserva.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now()
    where id = p_reserva_id;

  -- 9. Decrementar las plazas ocupadas de la clase, sin bajar nunca de 0
  --    (protección defensiva ante cualquier descuadre previo del contador).
  update public.clases
    set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0)
    where id = v_reserva.clase_id
    returning plazas_ocupadas into v_plazas_ocupadas;

  -- 10. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'clase_id', v_reserva.clase_id,
    'plazas_ocupadas', v_plazas_ocupadas,
    'reembolso_aplicable', v_reembolso_aplicable
  );
end;
$$;

comment on function public.cancelar_reserva(uuid) is
  'Cancela una reserva activa del cliente autenticado de forma atómica: valida propiedad de la reserva, que no esté ya cancelada y que la clase no haya empezado, bloquea las filas de reserva y clase para evitar condiciones de carrera, marca la reserva como cancelada, decrementa plazas_ocupadas (sin bajar de 0) y devuelve si quedaban 2h o más para el inicio (reembolso_aplicable), sin aplicar todavía ningún cargo o devolución real.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: solo usuarios autenticados.
--    Igual que en reservar_clase y reservas_de_mis_clases: se revoca el
--    EXECUTE a PUBLIC que Postgres concede por defecto al crear la función,
--    y se concede solo a authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.cancelar_reserva(uuid) to authenticated;
