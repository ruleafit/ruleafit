-- Deshace sql/093_invitaciones_cron.sql
select cron.unschedule('invitaciones-recuperar');
