-- Ruleafit · 083_avisos_zona_mantenimiento_cron_baja.sql · NO EJECUTADO.
-- Da de baja el cron de limpieza de avisos de zona. No toca datos ni funciones.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-purga') then
    perform cron.unschedule('avisos-zona-purga');
  end if;
end;
$$;
-- Comprobación: 0 filas.
select jobname from cron.job where jobname = 'avisos-zona-purga';
