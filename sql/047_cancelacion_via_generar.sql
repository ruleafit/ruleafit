-- 047_cancelacion_via_generar.sql
-- Reconvierte cancelar_clase y autocancelar_clases_sin_minimo (sql/038) para
-- que notifiquen via generar_notificacion (sql/045) en vez de insertar directo
-- en notificaciones_cola. Asi cada aviso deja constancia en historial ademas
-- de encolarse (estas categorias son criticas: siempre push). Los inserts
-- masivos pasan a bucles; el aviso al entrenador es una sola llamada. TODA la
-- logica de cancelacion (validaciones, FOR UPDATE, update de clases/reservas,
-- get diagnostics) queda IGUAL que en sql/038.

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
  v_cliente              uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar una clase.' using errcode = '28000';
  end if;

  select id, trainer_id, estado, fecha, hora, titulo
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes cancelar tus propias clases.' using errcode = '42501';
  end if;

  if v_clase.estado <> 'activa' then
    raise exception 'Esta clase ya está cancelada.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  update public.clases
    set estado = 'cancelada'
    where id = p_clase_id;

  -- Notificar a cada cliente con reserva activa, via generar_notificacion.
  for v_cliente in
    select r.cliente_id
    from public.reservas r
    where r.clase_id = p_clase_id and r.estado = 'activa'
  loop
    perform public.generar_notificacion(
      v_cliente,
      'sesion_cancelada',
      'Sesion cancelada',
      'Se ha cancelado la sesion: ' || v_clase.titulo,
      '/mis-reservas'
    );
  end loop;

  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now(),
        cancelada_por_entrenador = true
    where clase_id = p_clase_id
      and estado = 'activa';

  get diagnostics v_reservas_canceladas = row_count;

  return jsonb_build_object(
    'ok', true,
    'clase_id', p_clase_id,
    'reservas_canceladas', v_reservas_canceladas
  );
end;
$$;

comment on function public.cancelar_clase(uuid) is
  'Cancela una clase entera del entrenador autenticado de forma atomica: valida propiedad, que no este cancelada y que no haya empezado, bloquea la fila, marca la clase como cancelada, notifica via generar_notificacion a cada cliente con reserva activa (historial + push), y cancela de golpe todas las reservas activas marcandolas con cancelada_por_entrenador = true. Devuelve cuantas reservas se cancelaron.';

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
  v_cliente            uuid;
begin
  v_ahora_local := (now() at time zone 'Europe/Madrid');

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
    update public.clases
      set estado = 'cancelada',
          motivo_cancelacion = 'minimo'
      where id = v_clase.id;

    -- Notificar a cada cliente con reserva activa, via generar_notificacion.
    for v_cliente in
      select r.cliente_id
      from public.reservas r
      where r.clase_id = v_clase.id and r.estado = 'activa'
    loop
      perform public.generar_notificacion(
        v_cliente,
        'sesion_cancelada_minimo',
        'Sesion cancelada',
        'La sesion "' || v_clase.titulo || '" se ha cancelado por no alcanzar el minimo de plazas.',
        '/mis-reservas'
      );
    end loop;

    -- Notificar al entrenador (una sola llamada), via generar_notificacion.
    perform public.generar_notificacion(
      v_clase.trainer_id,
      'sesion_cancelada_minimo_entrenador',
      'Sesión cancelada',
      'Tu sesión "' || v_clase.titulo || '" se ha cancelado automáticamente por no alcanzar el mínimo de plazas.',
      '/mis-clases'
    );

    update public.reservas
      set estado = 'cancelada',
          cancelled_at = now()
      where clase_id = v_clase.id
        and estado = 'activa';

    v_clases_canceladas := v_clases_canceladas + 1;
  end loop;

  return v_clases_canceladas;
end;
$$;

comment on function public.autocancelar_clases_sin_minimo() is
  'Cron cada 5 minutos: cancela clases activas con plazas_min > 0 que sigan sin alcanzar el minimo al entrar en la ventana de 1h50 antes de su inicio, marcando motivo_cancelacion = ''minimo'', notificando via generar_notificacion a cada cliente con reserva activa y al entrenador (historial + push). Devuelve el numero de clases canceladas.';

revoke all on function public.autocancelar_clases_sin_minimo() from public;
