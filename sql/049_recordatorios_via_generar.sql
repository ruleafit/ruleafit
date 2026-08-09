-- 049_recordatorios_via_generar.sql
-- Reconvierte procesar_recordatorios (sql/042) para que encole via
-- generar_notificacion (sql/045) en vez de insertar directo en notificaciones_cola.
-- El DEDUPE via recordatorios_enviados (insert ... on conflict do nothing
-- returning) queda EXACTAMENTE IGUAL: es lo que garantiza una sola vez por
-- recordatorio. Unico cambio: por cada fila nueva devuelta por el returning se
-- llama a generar_notificacion en un bucle (historial siempre + push segun
-- preferencia de la categoria). Bandas, ventanas y condiciones IGUAL que sql/042.

create or replace function public.procesar_recordatorios()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora timestamp;
  v_rec   record;
begin
  v_ahora := (now() at time zone 'Europe/Madrid');

  -- CLIENTE 24h
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" es en menos de 24 horas.', '/mis-reservas'
      );
    end loop;
  exception when others then null; end;

  -- CLIENTE 7h
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" empieza dentro de unas horas.', '/mis-reservas'
      );
    end loop;
  exception when others then null; end;

  -- CLIENTE 2h (solo sesiones que alcanzaron el minimo)
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" empieza en menos de 2 horas.', '/mis-reservas'
      );
    end loop;
  exception when others then null; end;

  -- ENTRENADOR 24h
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" que impartes es en menos de 24 horas.', '/mis-clases'
      );
    end loop;
  exception when others then null; end;

  -- ENTRENADOR 7h
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" que impartes empieza dentro de unas horas.', '/mis-clases'
      );
    end loop;
  exception when others then null; end;

  -- ENTRENADOR 2h (solo sesiones que alcanzaron el minimo)
  begin
    for v_rec in
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
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Tu sesión "' || v_rec.titulo || '" que impartes empieza en menos de 2 horas.', '/mis-clases'
      );
    end loop;
  exception when others then null; end;

end;
$$;
