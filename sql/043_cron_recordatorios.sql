-- 043_cron_recordatorios.sql
-- Programa un cron (pg_cron) que ejecuta procesar_recordatorios() cada 5 min.
-- Encola en notificaciones_cola; el cron de envio (sql/040, cada minuto) las manda.
-- cron.schedule con el mismo nombre re-ejecuta de forma idempotente (actualiza el job).

select cron.schedule(
  'procesar-recordatorios',
  '*/5 * * * *',
  $$ select procesar_recordatorios(); $$
);
