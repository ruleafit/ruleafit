-- ============================================================================
-- Ruleafit · 103_blindaje_cobros_cron.sql
-- C3: cada 10 minutos pide las devoluciones pendientes (/api/payments/devolver).
-- ⛔ SOLO EN PRODUCCIÓN, con 096, 099 y 103 aplicados, la web publicada, REDSYS_* configurado y la devolución
-- probada contra el entorno de pruebas de Redsys. No ejecutar en la base de pruebas.
-- Sustituir <CRON_SECRET> por el valor real al pegarlo (no se versiona).
-- Baja: sql/103_blindaje_cobros_cron_baja.sql
-- ============================================================================
select cron.schedule(
  'procesar-devoluciones',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://www.ruleafit.com/api/payments/devolver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    timeout_milliseconds := 60000
  );
  $$
);
