-- ============================================================================
-- Ruleafit · 093_invitaciones_reversion.sql
-- Deshace C25 (invitaciones): elimina el trigger de auth.users, las funciones y las tablas. NO retira Rulos ya
-- concedidos (quedan en el libro). Los dos motivos del libro solo se borran si ningún movimiento los usa.
-- Antes, si se aplicó 093_invitaciones_cron.sql, ejecutar 093_invitaciones_cron_baja.sql.
-- ============================================================================
drop trigger if exists on_auth_user_invitacion on auth.users;

drop function if exists public.recuperar_invitaciones();
drop function if exists public.procesar_invitacion_alta();
drop function if exists public.reclamar_invitacion(text);
drop function if exists public.aplicar_invitacion(uuid, text);
drop function if exists public.abrir_invitacion(text);
drop function if exists public.invitacion_valida(text);
drop function if exists public.mi_codigo_invitacion();

drop table if exists public.invitaciones;
drop table if exists public.invitaciones_abiertas;
drop table if exists public.codigos_invitacion;

delete from public.rulos_motivos m
 where m.codigo in ('invitacion_enviada', 'invitacion_recibida')
   and not exists (select 1 from public.rulos_movimientos r where r.motivo = m.codigo);
