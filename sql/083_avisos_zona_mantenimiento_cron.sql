-- ============================================================================
-- Ruleafit · 083_avisos_zona_mantenimiento_cron.sql
-- Programa la limpieza diaria de las tablas de control de avisos de zona.
-- NO EJECUTADO: solo con autorización expresa y DESPUÉS de sql/083_avisos_zona_mantenimiento.sql.
-- Diario a las 04:30 UTC (el cron de purga del historial va a las 04:00 UTC).
-- Idempotente. Baja: sql/083_avisos_zona_mantenimiento_cron_baja.sql.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                  and proname = 'avisos_zona_purgar_control') then
    raise exception 'Primero hay que aplicar sql/083_avisos_zona_mantenimiento.sql';
  end if;
end;
$$;

select cron.schedule('avisos-zona-purga', '30 4 * * *', $cron$ select public.avisos_zona_purgar_control(); $cron$);

select jobname, schedule, active from cron.job where jobname = 'avisos-zona-purga';
