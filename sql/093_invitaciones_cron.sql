-- ============================================================================
-- Ruleafit · 093_invitaciones_cron.sql   (SEPARADO del SQL principal: toca la programación de tareas)
-- C25 · Red de seguridad: cada 5 minutos reintenta, de forma idempotente, las recompensas de invitación de cuentas ya
-- confirmadas cuyo billete siguió abierto (por ejemplo, un fallo temporal al confirmar el correo).
-- Baja: sql/093_invitaciones_cron_baja.sql
-- ============================================================================
select cron.schedule('invitaciones-recuperar', '*/5 * * * *', $$ select public.recuperar_invitaciones(); $$);
