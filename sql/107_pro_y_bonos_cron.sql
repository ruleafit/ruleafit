-- ============================================================================
-- Ruleafit · 107_pro_y_bonos_cron.sql
-- Cada hora: caduca suscripciones Pro vencidas y cobra las renovaciones pendientes (/api/payments/pro/renovar).
-- ⛔ SOLO EN PRODUCCIÓN, con 107 aplicado, la web publicada, el cobro recurrente contratado con el banco y probado
-- contra el entorno de pruebas de Redsys. No ejecutar en la base de pruebas.
-- Sustituir <CRON_SECRET> por el valor real al pegarlo (no se versiona).
-- Baja: sql/107_pro_y_bonos_cron_baja.sql
-- ============================================================================
select cron.schedule(
  'renovar-pro',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://www.ruleafit.com/api/payments/pro/renovar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    timeout_milliseconds := 60000
  );
  $$
);
