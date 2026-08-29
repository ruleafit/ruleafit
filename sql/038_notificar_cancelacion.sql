-- ============================================================================
-- Ruleafit · 038_notificar_cancelacion.sql
-- Añade una notificación en notificaciones_cola para cada cliente con reserva
-- activa cuando su sesión se cancela, tanto si la cancela el entrenador
-- (cancelar_clase) como si se cancela sola por no alcanzar el mínimo
-- (autocancelar_clases_sin_minimo).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tabla public.reservas), sql/016_tabla_clases.sql
-- (columna titulo en public.clases), sql/036_notificaciones_cola.sql (tabla
-- notificaciones_cola) y sustituye por completo a cancelar_clase() de
-- sql/008_aviso_cancelacion_entrenador.sql y a
-- autocancelar_clases_sin_minimo() de sql/033_autocancelar_sin_minimo.sql
-- (ambas CREATE OR REPLACE, mismas firmas, no hace falta DROP).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función RPC cancelar_clase(p_clase_id uuid)
--    Igual que la versión de sql/008_aviso_cancelacion_entrenador.sql, con
--    dos cambios: el SELECT que carga v_clase ahora incluye "titulo" (para
--    poder componer el mensaje de la notificación), y justo antes de
--    cancelar las reservas se inserta una notificación por cada cliente con
--    reserva activa.
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
  select id, trainer_id, estado, fecha, hora, titulo
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

  -- Notificar a cada cliente con reserva activa que su sesion se cancela.
  insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
  select r.cliente_id, 'sesion_cancelada',
         'Sesion cancelada',
         'Se ha cancelado la sesion: ' || v_clase.titulo,
         '/mis-reservas'
  from public.reservas r
  where r.clase_id = p_clase_id and r.estado = 'activa';

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
  'Cancela una clase entera del entrenador autenticado de forma atómica: valida propiedad de la clase (trainer_id = auth.uid()), que no esté ya cancelada y que no haya empezado, bloquea la fila de la clase para evitar condiciones de carrera, marca la clase como cancelada, inserta una notificación en notificaciones_cola para cada cliente con reserva activa, y cancela de golpe todas las reservas activas asociadas marcándolas con cancelada_por_entrenador = true (para que el cliente distinga esta cancelación de una hecha por él mismo), sin cargo ni devolución real todavía. Devuelve cuántas reservas se cancelaron.';

-- Permisos de ejecución sin cambios respecto a sql/007_minimo_y_cancelar_clase.sql
-- (ya concedidos a authenticated); CREATE OR REPLACE no los toca ni los
-- borra, así que no hace falta repetir el revoke/grant.


-- ----------------------------------------------------------------------------
-- 2) Función autocancelar_clases_sin_minimo()
--    Igual que la versión de sql/033_autocancelar_sin_minimo.sql, con dos
--    cambios: el SELECT del bucle ahora incluye "titulo" (para poder
--    componer el mensaje de la notificación), y justo antes de cancelar las
--    reservas de cada clase se inserta una notificación por cada cliente con
--    reserva activa.
-- ----------------------------------------------------------------------------
create or replace function public.autocancelar_clases_sin_minimo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora_local        timestamp;
  v_clase              record;
  v_clases_canceladas  integer := 0;
begin
  -- 1. Hora actual en zona horaria de España, mismo criterio que
  --    reservar_clase/cancelar_reserva/cancelar_clase.
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  -- 2. Clases candidatas: activas, con mínimo definido, por debajo del
  --    mínimo, que todavía no han empezado y que ya están dentro de la
  --    ventana de 1h50 antes de su inicio. FOR UPDATE bloquea cada fila
  --    hasta que termine esta transacción, igual que en cancelar_clase().
  for v_clase in
    select id, fecha, hora, titulo, trainer_id
      from public.clases
      where estado = 'activa'
        and plazas_min > 0
        and plazas_ocupadas < plazas_min
        and (fecha::text || ' ' || hora::text)::timestamp > v_ahora_local
        and (fecha::text || ' ' || hora::text)::timestamp <= v_ahora_local + interval '1 hour 50 minutes'
      for update
  loop
    -- 3a. Marcar la clase como cancelada, con motivo 'minimo'.
    update public.clases
      set estado = 'cancelada',
          motivo_cancelacion = 'minimo'
      where id = v_clase.id;

    -- Notificar a cada cliente con reserva activa que su sesion se cancela.
    insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select r.cliente_id, 'sesion_cancelada_minimo',
           'Sesion cancelada',
           'La sesion "' || v_clase.titulo || '" se ha cancelado por no alcanzar el minimo de plazas.',
           '/mis-reservas'
    from public.reservas r
    where r.clase_id = v_clase.id and r.estado = 'activa';

    -- Notificar tambien al entrenador de que su sesion se ha autocancelado.
    insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    values (
      v_clase.trainer_id,
      'sesion_cancelada_minimo_entrenador',
      'Sesión cancelada',
      'Tu sesión "' || v_clase.titulo || '" se ha cancelado automáticamente por no alcanzar el mínimo de plazas.',
      '/mis-clases'
    );

    -- 3b. Cancelar de golpe todas las reservas activas de esta clase.
    --     cancelada_por_entrenador se deja en su valor por defecto (false):
    --     esta cancelación no la decide el entrenador, la dispara el
    --     sistema por no alcanzar el mínimo.
    update public.reservas
      set estado = 'cancelada',
          cancelled_at = now()
      where clase_id = v_clase.id
        and estado = 'activa';

    -- 3c. Contar esta clase como cancelada en esta ejecución.
    v_clases_canceladas := v_clases_canceladas + 1;
  end loop;

  -- 4. Devolver cuántas clases se cancelaron en esta ejecución.
  return v_clases_canceladas;
end;
$$;

comment on function public.autocancelar_clases_sin_minimo() is
  'Pensada para ser ejecutada por un cron cada 5 minutos: cancela automáticamente las clases activas con plazas_min > 0 que sigan sin alcanzar el mínimo cuando entran en la ventana de 1h50 antes de su inicio (misma lógica de cancelación en bloque que cancelar_clase, marcando motivo_cancelacion = ''minimo'' y sin tocar cancelada_por_entrenador), insertando además una notificación en notificaciones_cola para cada cliente con reserva activa. No valida propiedad ni auth.uid(): la invoca el sistema, no un usuario concreto. Devuelve el número de clases canceladas en la ejecución.';


-- ----------------------------------------------------------------------------
-- 3) Permisos de ejecución: ninguno para roles de cliente.
--    A diferencia de las funciones que llama el usuario final (reservar_clase,
--    cancelar_reserva, cancelar_clase...), esta no se concede a authenticated:
--    solo debe poder ejecutarla el propio sistema (cron/postgres), nunca
--    desde el cliente.
-- ----------------------------------------------------------------------------
revoke all on function public.autocancelar_clases_sin_minimo() from public;
