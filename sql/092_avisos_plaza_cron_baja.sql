-- Deshace sql/092_avisos_plaza_cron.sql
select cron.unschedule('avisos-plaza-recuperar');
select cron.unschedule('avisos-plaza-limpieza');
select cron.alter_job((select jobid from cron.job where jobname = 'procesar-notificaciones'), schedule := '* * * * *');
