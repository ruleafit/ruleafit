-- 042_procesar_recordatorios.sql
-- Escanea sesiones activas y encola recordatorios en notificaciones_cola,
-- deduplicando via recordatorios_enviados. Tres ventanas por bandas:
--   24h: inicio en (ahora+7h, ahora+24h]
--   7h : inicio en (ahora+2h, ahora+7h]
--   2h : inicio en (ahora+1h50, ahora+2h]  y solo si plazas_ocupadas >= plazas_min
-- Cada bloque va envuelto en su propio begin/exception para que un fallo en
-- una banda no aborte las demas. Hora local Europe/Madrid, igual que autocancelar.

create or replace function public.procesar_recordatorios()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora timestamp;
begin
  v_ahora := (now() at time zone 'Europe/Madrid');

  -- CLIENTE 24h
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, r.cliente_id, 'recordatorio_sesion_24h'
      from clases c
      join reservas r on r.clase_id = c.id and r.estado = 'activa'
      where c.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '7 hours'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '24 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" es en menos de 24 horas.', '/mis-reservas'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

  -- CLIENTE 7h
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, r.cliente_id, 'recordatorio_sesion_7h'
      from clases c
      join reservas r on r.clase_id = c.id and r.estado = 'activa'
      where c.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '2 hours'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '7 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" empieza dentro de unas horas.', '/mis-reservas'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

  -- CLIENTE 2h (solo sesiones que alcanzaron el minimo)
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, r.cliente_id, 'recordatorio_sesion_2h'
      from clases c
      join reservas r on r.clase_id = c.id and r.estado = 'activa'
      where c.estado = 'activa'
        and c.plazas_ocupadas >= c.plazas_min
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '1 hour 50 minutes'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '2 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" empieza en menos de 2 horas.', '/mis-reservas'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

  -- ENTRENADOR 24h
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, c.trainer_id, 'recordatorio_sesion_24h_entrenador'
      from clases c
      where c.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '7 hours'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '24 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" que impartes es en menos de 24 horas.', '/mis-clases'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

  -- ENTRENADOR 7h
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, c.trainer_id, 'recordatorio_sesion_7h_entrenador'
      from clases c
      where c.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '2 hours'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '7 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" que impartes empieza dentro de unas horas.', '/mis-clases'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

  -- ENTRENADOR 2h (solo sesiones que alcanzaron el minimo)
  begin
    with nuevos as (
      insert into recordatorios_enviados (clase_id, usuario_id, tipo)
      select c.id, c.trainer_id, 'recordatorio_sesion_2h_entrenador'
      from clases c
      where c.estado = 'activa'
        and c.plazas_ocupadas >= c.plazas_min
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora + interval '1 hour 50 minutes'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '2 hours'
      on conflict (clase_id, usuario_id, tipo) do nothing
      returning clase_id, usuario_id, tipo
    )
    insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    select n.usuario_id, n.tipo, 'Recordatorio de sesión',
           'Tu sesión "' || c.titulo || '" que impartes empieza en menos de 2 horas.', '/mis-clases'
    from nuevos n join clases c on c.id = n.clase_id;
  exception when others then null; end;

end;
$$;
