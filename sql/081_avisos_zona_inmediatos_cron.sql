-- ============================================================================
-- Ruleafit · 081_avisos_zona_inmediatos_cron.sql
-- Programa el cron del motor de avisos inmediatos (cada minuto).
--
-- NO EJECUTADO. Se aplica SOLO tras sql/081_avisos_zona_inmediatos.sql y SOLO con
-- autorización expresa. Con los interruptores globales APAGADOS (estado inicial) el
-- cron no avisa a nadie: solo avanza el cursor del motor para no generar avisos
-- retroactivos al encender.
--
-- Se niega a programarse si el interruptor de inmediatos está ENCENDIDO (la
-- activación es un paso posterior y separado) o si faltan las funciones.
-- Es idempotente (cron.schedule con el mismo nombre actualiza el trabajo).
-- Darlo de baja: sql/081_avisos_zona_inmediatos_cron_baja.sql.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                  and proname = 'procesar_avisos_zona_inmediatos') then
    raise exception 'Primero hay que aplicar sql/081_avisos_zona_inmediatos.sql';
  end if;
  if exists (select 1 from public.config_avisos_zona where inmediatos_activos) then
    raise exception 'El interruptor de avisos inmediatos está encendido: programa el cron con él apagado';
  end if;
end;
$$;

select cron.schedule(
  'avisos-zona-inmediatos',
  '* * * * *',
  $cron$ select public.procesar_avisos_zona_inmediatos(); $cron$
);

-- Comprobación: debe mostrar 1 fila, activa, cada minuto.
select jobname, schedule, active, command from cron.job where jobname = 'avisos-zona-inmediatos';
