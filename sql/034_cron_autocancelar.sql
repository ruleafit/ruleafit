-- 034_cron_autocancelar.sql
-- Programa un cron (pg_cron) que ejecuta autocancelar_clases_sin_minimo()
-- cada 5 minutos. A partir de aqui, las clases que no alcanzan su plazas_min
-- se cancelan solas ~1h50 antes de empezar, sin intervencion manual.
-- Requiere: extension pg_cron activada (hecho) y funcion sql/033.

select cron.schedule(
  'autocancelar-clases',
  '*/5 * * * *',
  $$ select autocancelar_clases_sin_minimo(); $$
);
