-- ============================================================================
-- Ruleafit · 062_recordatorio_10min_entrenador.sql
-- Nuevo recordatorio para el entrenador/organizador: 10 minutos antes de que
-- empiece su sesión, para que revise los nombres de los inscritos antes de
-- comenzar. Pedido por el usuario el 12 de septiembre de 2026.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "ruleafit").
--
-- Reutiliza TODO lo que ya existe para los demás recordatorios (24h/7h/2h):
-- el cron `procesar-recordatorios` (sql/043, cada 5 minutos, no hay que
-- tocarlo), la tabla anti-duplicados `recordatorios_enviados` (sql/041, el
-- campo `tipo` es texto libre, no hace falta migrar el esquema), y el
-- catálogo de categorías desactivables de `generar_notificacion()` (sql/050,
-- `categoria` también es texto libre en `preferencias_notificaciones`).
--
-- Solo hacen falta dos cambios de CUERPO de función (mismas firmas de
-- siempre, por eso es CREATE OR REPLACE sin DROP):
--   1) generar_notificacion(): nuevo mapeo tipo -> categoria
--      ('recordatorio_sesion_10min_entrenador' -> 'recordatorio_10min_entrenador').
--   2) procesar_recordatorios(): nuevo bloque ENTRENADOR 10 min.
--
-- Ventana elegida: sesión entre AHORA y AHORA+10min. Con el cron cada 5
-- minutos, esto garantiza que el aviso salta siempre entre 5 y 10 minutos
-- antes de empezar (igual de "impreciso" que los recordatorios de 2h/7h/24h
-- ya existentes, que tienen el mismo margen de 10 min por el mismo motivo).
--
-- Guarda pedida por el usuario: SOLO si la sesión sigue activa (no
-- cancelada). A diferencia del recordatorio de 2h, aquí NO se exige que
-- plazas_ocupadas >= plazas_min, porque esa comprobación ya la hizo antes
-- autocancelar_clases_sin_minimo() (se cancela con 2h de antelación si no
-- llega al mínimo) — si a 10 minutos de empezar la clase sigue con
-- estado = 'activa', es que ya pasó ese filtro y va a darse sí o sí.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) generar_notificacion(): añade el mapeo del nuevo tipo. Cuerpo completo
--    igual que sql/050, solo con el nuevo "when" añadido.
-- ----------------------------------------------------------------------------
create or replace function public.generar_notificacion(
  p_usuario_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_cuerpo     text,
  p_url        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text;
  v_critica   boolean := false;
  v_activa    boolean;
begin
  -- Mapear tipo -> categoria. Para la mayoria, la categoria es el propio tipo.
  case p_tipo
    when 'sesion_publicada' then
      v_categoria := 'publicaciones';
    when 'recordatorio_sesion_24h' then
      v_categoria := 'recordatorio_24h';
    when 'recordatorio_sesion_7h' then
      v_categoria := 'recordatorio_7h';
    when 'recordatorio_sesion_2h' then
      v_categoria := 'recordatorio_2h';
    when 'recordatorio_sesion_24h_entrenador' then
      v_categoria := 'recordatorio_24h_entrenador';
    when 'recordatorio_sesion_7h_entrenador' then
      v_categoria := 'recordatorio_7h_entrenador';
    when 'recordatorio_sesion_2h_entrenador' then
      v_categoria := 'recordatorio_2h_entrenador';
    when 'recordatorio_sesion_10min_entrenador' then
      v_categoria := 'recordatorio_10min_entrenador';
    when 'plazas_agotadas' then
      v_categoria := 'plazas_agotadas';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      -- Tipo desconocido: por seguridad se envia (critico).
      v_categoria := 'otras';
      v_critica := true;
  end case;

  -- Historial SIEMPRE.
  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  -- Decidir push. Opt-out: sin fila = activa.
  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  -- Encolar push solo si procede.
  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2) procesar_recordatorios(): cuerpo completo igual que sql/049, con un
--    nuevo bloque "ENTRENADOR 10 min" añadido al final.
-- ----------------------------------------------------------------------------
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

  -- ENTRENADOR 10 min (nuevo, 12 sept 2026): solo exige que la sesión no
  -- se haya cancelado. No se exige plazas_ocupadas >= plazas_min porque a
  -- estas alturas (10 min antes) ya pasó el corte de autocancelación por
  -- mínimo, que se aplica 2h antes.
  begin
    for v_rec in
      with nuevos as (
        insert into recordatorios_enviados (clase_id, usuario_id, tipo)
        select c.id, c.trainer_id, 'recordatorio_sesion_10min_entrenador'
        from clases c
        where c.estado = 'activa'
          and (c.fecha::text || ' ' || c.hora::text)::timestamp >  v_ahora
          and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora + interval '10 minutes'
        on conflict (clase_id, usuario_id, tipo) do nothing
        returning clase_id, usuario_id, tipo
      )
      select n.usuario_id, n.tipo, c.titulo
      from nuevos n join clases c on c.id = n.clase_id
    loop
      perform public.generar_notificacion(
        v_rec.usuario_id, v_rec.tipo, 'Recordatorio de sesión',
        'Recuerda revisar los nombres de tus participantes. Tu sesión empieza en breve.', '/mis-clases'
      );
    end loop;
  exception when others then null; end;

end;
$$;


-- ----------------------------------------------------------------------------
-- Verificación post-deploy sugerida (SQL Editor):
--   -- Crear una clase de prueba con hora dentro de los próximos 10 minutos
--   -- y plazas_ocupadas > 0, esperar a que pase el cron (cada 5 min) y
--   -- comprobar que aparece en el historial de notificaciones del
--   -- entrenador de prueba con el texto nuevo.
--   select * from recordatorios_enviados where tipo = 'recordatorio_sesion_10min_entrenador';
-- ============================================================================
