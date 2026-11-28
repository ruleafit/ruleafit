-- Baja del cron de cierre de liquidaciones.
select cron.unschedule('cerrar-liquidacion');
