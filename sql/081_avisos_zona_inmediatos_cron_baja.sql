-- ============================================================================
-- Ruleafit · 081_avisos_zona_inmediatos_cron_baja.sql
-- Da de baja el cron del motor de avisos inmediatos. NO EJECUTADO.
-- No toca ningún dato ni función: el motor queda sin ejecutarse. Si se vuelve a
-- programar más tarde, el motor recupera las sesiones publicadas durante la
-- parada (salvo que el interruptor estuviera apagado o se haya reactivado: en ese
-- caso no hay avisos retroactivos, como está diseñado).
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-inmediatos') then
    perform cron.unschedule('avisos-zona-inmediatos');
  end if;
end;
$$;

-- Comprobación: debe devolver 0 filas.
select jobname from cron.job where jobname = 'avisos-zona-inmediatos';
