-- ============================================================================
-- Ruleafit · 089_valoraciones_y_avisos_cron.sql
-- Programa solicitar_valoraciones() cada 10 minutos (C16). Idempotente: cron.schedule con el mismo
-- nombre actualiza el trabajo. Baja: select cron.unschedule('solicitar-valoraciones');
-- ============================================================================
select cron.schedule(
  'solicitar-valoraciones',
  '*/10 * * * *',
  $$ select public.solicitar_valoraciones(); $$
);
