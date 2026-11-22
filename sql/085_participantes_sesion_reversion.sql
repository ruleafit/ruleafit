-- Ruleafit · 085_participantes_sesion_reversion.sql · NO EJECUTADO.
-- Deshace sql/085: borra la función y la tabla de preferencias. NO toca reservas ni perfiles.
-- (Si se borra la tabla se pierden las preferencias de privacidad guardadas.)
begin;
drop function if exists public.participantes_clase(uuid);
drop table if exists public.perfil_privacidad;
commit;
