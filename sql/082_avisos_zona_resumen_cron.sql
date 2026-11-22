-- ============================================================================
-- Ruleafit · 082_avisos_zona_resumen_cron.sql
-- Programa el cron del resumen diario. NO EJECUTADO: solo con autorización expresa
-- y DESPUÉS de sql/082_avisos_zona_resumen.sql.
--
-- pg_cron trabaja en UTC. Las 20:30 de Madrid son las 18:30 UTC en verano y las
-- 19:30 UTC en invierno, y la franja de envío (20:30-22:30 Madrid) cae entre las
-- 18:30 y las 21:30 UTC. El cron se lanza cada 5 minutos de 18:00 a 21:55 UTC y la
-- función decide por la hora de Madrid (no hay que cambiar nada con el horario).
-- Fuera de la franja la función sale sin escribir nada.
--
-- Se niega a programarse si el interruptor del resumen está ENCENDIDO (la
-- activación es un paso posterior y separado) o si faltan las funciones.
-- Idempotente. Baja: sql/082_avisos_zona_resumen_cron_baja.sql.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                  and proname = 'procesar_avisos_zona_resumen') then
    raise exception 'Primero hay que aplicar sql/082_avisos_zona_resumen.sql';
  end if;
  if exists (select 1 from public.config_avisos_zona where resumen_activo) then
    raise exception 'El interruptor del resumen está encendido: programa el cron con él apagado';
  end if;
end;
$$;

select cron.schedule(
  'avisos-zona-resumen',
  '*/5 18-21 * * *',
  $cron$ select public.procesar_avisos_zona_resumen(); $cron$
);

-- Comprobación: 1 fila, activa.
select jobname, schedule, active, command from cron.job where jobname = 'avisos-zona-resumen';
