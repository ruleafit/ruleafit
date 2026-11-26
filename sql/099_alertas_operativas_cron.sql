-- ============================================================================
-- Ruleafit · 099_alertas_operativas_cron.sql
-- Cada 5 minutos: revisa la salud de los pagos y envía por correo las alertas nuevas (/api/alertas).
-- Ejecutar DESPUÉS de aplicar 099 y de desplegar la web con la ruta /api/alertas.
-- IMPORTANTE: sustituir <CRON_SECRET> por el valor real al pegarlo (no se versiona).
-- Baja: sql/099_alertas_operativas_cron_baja.sql
-- ============================================================================
select cron.schedule(
  'alertas-operativas',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://www.ruleafit.com/api/alertas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    )
  );
  $$
);
