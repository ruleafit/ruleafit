-- ============================================================================
-- Openfit · 053_fix_plazas_ocupadas_autocancelacion.sql
-- autocancelar_clases_sin_minimo() cancela en bloque las reservas activas de
-- la clase pero nunca toca clases.plazas_ocupadas, así que el contador se
-- queda congelado con el valor previo a la autocancelación en vez de reflejar
-- que ya no queda ninguna reserva activa (mismo problema que ya se corrigió
-- para cancelar_clase() en sql/011_panel_entrenador_y_contador.sql, pero que
-- nunca se aplicó aquí). Se corrige poniendo plazas_ocupadas a 0 en el mismo
-- UPDATE que marca la clase como cancelada con motivo_cancelacion = 'minimo'.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/047_cancelacion_via_generar.sql (versión vigente de
-- autocancelar_clases_sin_minimo, que es la que se recrea aquí entera porque
-- CREATE OR REPLACE sustituye el cuerpo completo). La firma de la función
-- (sin parámetros, returns integer) no cambia, así que no hace falta DROP
-- FUNCTION previo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) autocancelar_clases_sin_minimo(): añade "plazas_ocupadas = 0" al UPDATE
--    que marca la clase como cancelada por no alcanzar el mínimo. Resto de la
--    función idéntico a sql/047 (umbral de 1h50, cancelación de reservas,
--    notificaciones vía generar_notificacion, SECURITY DEFINER, search_path).
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
    -- Marcar la clase como cancelada, con motivo 'minimo', y poner
    -- plazas_ocupadas a 0: a continuación se cancelan de golpe todas las
    -- reservas activas de la clase, así que el recuento de activas pasa a
    -- ser 0 sin excepción (mismo ajuste que cancelar_clase() hace desde
    -- sql/011_panel_entrenador_y_contador.sql).
    update public.clases
      set estado = 'cancelada',
          motivo_cancelacion = 'minimo',
          plazas_ocupadas = 0
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
  'Cron cada 5 minutos: cancela clases activas con plazas_min > 0 que sigan sin alcanzar el minimo al entrar en la ventana de 1h50 antes de su inicio, marcando motivo_cancelacion = ''minimo'' y plazas_ocupadas = 0 (ya no queda ninguna reserva activa), notificando via generar_notificacion a cada cliente con reserva activa y al entrenador (historial + push). Devuelve el numero de clases canceladas.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: sin cambios respecto a sql/047 (ninguno para
--    authenticated; solo la invoca el cron/postgres). CREATE OR REPLACE no
--    toca los permisos existentes, pero se repite el revoke explícito por
--    coherencia con el resto de archivos del proyecto.
-- ----------------------------------------------------------------------------
revoke all on function public.autocancelar_clases_sin_minimo() from public;
