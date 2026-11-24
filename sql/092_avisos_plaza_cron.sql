-- ============================================================================
-- Ruleafit · 092_avisos_plaza_cron.sql   (SEPARADO del SQL principal: toca la programación de tareas)
-- C15 · Tareas programadas:
--  1) avisos-plaza-recuperar (cada 30 s): recupera episodios pendientes/con error (red de seguridad; el aviso normal
--     sale en el propio commit de la cancelación, sin esperar a este cron).
--  2) avisos-plaza-limpieza (cada hora, minuto 17): borra alertas de sesiones empezadas/canceladas y episodios antiguos.
--  3) procesar-notificaciones: pasa de «cada minuto» a «cada 10 segundos» para que el push salga enseguida. No se
--     cambia la orden (ni su clave): solo la frecuencia. La ruta de la cola reclama cada notificación de forma
--     atómica, así que las ejecuciones solapadas no duplican envíos.
-- Baja: sql/092_avisos_plaza_cron_baja.sql
-- ============================================================================
select cron.schedule('avisos-plaza-recuperar', '30 seconds', $$ select public.procesar_episodios_plaza_pendientes(); $$);
select cron.schedule('avisos-plaza-limpieza', '17 * * * *', $$ select public.limpiar_avisos_plaza(); $$);
select cron.alter_job((select jobid from cron.job where jobname = 'procesar-notificaciones'), schedule := '10 seconds');
