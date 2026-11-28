-- ============================================================================
-- Ruleafit · 115_fichero_sepa_cron.sql
-- A diario (03:30 UTC) llama a la web; la web solo cierra la liquidación los días 1 y 16 de Madrid y avisa por correo.
-- ⛔ SOLO EN PRODUCCIÓN, con 114 y 115 aplicados, la web publicada y los pagos en marcha. No ejecutar en pruebas.
-- Sustituir <CRON_SECRET> por el valor real al pegarlo (no se versiona).
-- Baja: sql/115_fichero_sepa_cron_baja.sql
-- ============================================================================
select cron.schedule(
  'cerrar-liquidacion',
  '30 3 * * *',
  $$
  select net.http_post(
    url     := 'https://www.ruleafit.com/api/payments/liquidaciones/cierre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    timeout_milliseconds := 60000
  );
  $$
);
