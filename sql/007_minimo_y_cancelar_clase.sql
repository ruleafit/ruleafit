-- ============================================================================
-- Openfit · 007_minimo_y_cancelar_clase.sql
-- Mínimo de plazas por clase (columna, sin lógica de confirmación todavía) y
-- cancelación de una clase entera por parte del entrenador.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tablas public.clases / public.reservas,
-- criterio de fecha+hora exacta en Europe/Madrid) y del mismo patrón de
-- bloqueo de fila (FOR UPDATE) y validación de propiedad ya usado en
-- sql/003_cancelaciones.sql y sql/006_open_fidelizacion.sql
-- (marcar_asistencia).
--
-- Nota: este archivo solo añade la columna y la función RPC. NO toca
-- interfaz (ni el campo en /publicar, ni ningún aviso de "pendiente de
-- confirmación", ni un botón de cancelar clase), ni pagos/cartera/Open/mapas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Columna public.clases.plazas_min
--    NOT NULL DEFAULT 0: las filas ya existentes quedan con plazas_min = 0,
--    que equivale a "sin mínimo" (siempre se consideran confirmadas; no se
--    implementa aquí ninguna lógica que use este valor todavía).
--    CHECK plazas_min entre 0 y plazas_max: nunca se puede pedir un mínimo
--    mayor que el aforo máximo de la propia clase. Al añadir la columna con
--    DEFAULT 0, las filas existentes ya cumplen el check sin necesidad de
--    backfill aparte (0 <= plazas_max siempre, salvo que plazas_max fuera
--    negativo, lo cual no debería darse).
-- ----------------------------------------------------------------------------
alter table public.clases
  add column plazas_min integer not null default 0,
  add constraint clases_plazas_min_rango
    check (plazas_min >= 0 and plazas_min <= plazas_max);

comment on column public.clases.plazas_min is
  'Mínimo de plazas para que la clase se considere confirmada. 0 = sin mínimo (siempre confirmada). De momento es solo un dato: no hay lógica todavía que lo use para avisar de "pendiente de confirmación" ni para cancelar automáticamente.';


-- ----------------------------------------------------------------------------
-- 2) Función RPC cancelar_clase(p_clase_id uuid)
--    Hace todas las comprobaciones y la escritura en una sola transacción
--    implícita: si cualquier "raise exception" salta, Postgres deshace
--    automáticamente todo lo que la función haya hecho hasta ese punto (nada
--    de clase cancelada con reservas sueltas a medias).
--
--    No comprueba el rol del usuario vía user_metadata (a diferencia de
--    reservar_clase/reservas_de_mis_clases): igual que cancelar_reserva() y
--    marcar_asistencia(), basta con la comprobación de propiedad
--    (trainer_id = auth.uid()) para que nadie pueda cancelar una clase que
--    no es suya; un cliente sin clases propias nunca cumple esa condición
--    para ningún p_clase_id.
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
  --    reserva individual). GET DIAGNOSTICS recoge cuántas filas afectó el
  --    UPDATE para poder informar al entrenador.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now()
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
  'Cancela una clase entera del entrenador autenticado de forma atómica: valida propiedad de la clase (trainer_id = auth.uid()), que no esté ya cancelada y que no haya empezado, bloquea la fila de la clase para evitar condiciones de carrera, marca la clase como cancelada y cancela de golpe todas las reservas activas asociadas (mismo criterio que cancelar_reserva, sin cargo ni devolución real todavía). Devuelve cuántas reservas se cancelaron.';


-- ----------------------------------------------------------------------------
-- 3) Permisos de ejecución: solo usuarios autenticados.
--    Igual que en reservar_clase, cancelar_reserva y marcar_asistencia: se
--    revoca el EXECUTE a PUBLIC que Postgres concede por defecto al crear la
--    función, y se concede solo a authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.cancelar_clase(uuid) from public;
grant execute on function public.cancelar_clase(uuid) to authenticated;
