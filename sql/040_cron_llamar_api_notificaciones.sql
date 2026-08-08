-- 040_cron_llamar_api_notificaciones.sql
-- Programa un cron (pg_cron) que cada minuto hace una llamada HTTP POST
-- (via pg_net) a la API de produccion /api/procesar-notificaciones, que
-- procesa la cola de notificaciones y envia las push pendientes.
-- Requiere las extensiones pg_cron y pg_net instaladas.
--
-- IMPORTANTE: el token de abajo es un PLACEHOLDER. Al ejecutar este SQL en
-- Supabase, sustituir <CRON_SECRET> por el valor real de la variable
-- CRON_SECRET (que NO se versiona en git). El valor real vive en .env.local
-- y en las variables de entorno de Vercel.
--
-- NOTA: este archivo documenta la migracion; el cron YA fue ejecutado y esta
-- activo en Supabase (jobid 2, jobname 'procesar-notificaciones').

select cron.schedule(
  'procesar-notificaciones',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://www.ruleafit.com/api/procesar-notificaciones',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    )
  );
  $$
);
