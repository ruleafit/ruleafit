-- ============================================================================
-- Ruleafit · 082_avisos_zona_resumen_cron_baja.sql
-- Da de baja el cron del resumen diario. NO EJECUTADO. No toca datos ni funciones.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-resumen') then
    perform cron.unschedule('avisos-zona-resumen');
  end if;
end;
$$;

-- Comprobación: 0 filas.
select jobname from cron.job where jobname = 'avisos-zona-resumen';
