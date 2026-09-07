-- ============================================================================
-- Ruleafit · 056_purgar_notificaciones_historial.sql
-- Purga automática del historial de notificaciones (public.notificaciones_historial,
-- sql/044): por cada usuario_id, conserva solo las 10 filas más recientes
-- (según created_at) y borra el resto. Evita que la tabla crezca sin límite.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "ruleafit").
--
-- Depende de sql/044_tablas_historial_preferencias.sql (tabla
-- public.notificaciones_historial). Sigue el mismo patrón de función de
-- mantenimiento que autocancelar_clases_sin_minimo() (sql/033) y el mismo
-- patrón de cron que sql/034_cron_autocancelar.sql / sql/043_cron_recordatorios.sql.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función purgar_notificaciones_historial()
--    Sin parámetros: no la llama un usuario concreto, la llama el sistema
--    (cron), así que no hay auth.uid() que comprobar ni propiedad que
--    validar, igual que autocancelar_clases_sin_minimo().
--    Usa row_number() particionado por usuario_id y ordenado por created_at
--    desc para identificar, por usuario, qué filas quedan fuera del top 10
--    más reciente, y las borra en un único delete.
-- ----------------------------------------------------------------------------
create or replace function public.purgar_notificaciones_historial()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas_borradas integer := 0;
begin
  with numeradas as (
    select id,
           row_number() over (partition by usuario_id order by created_at desc) as rn
      from public.notificaciones_historial
  ),
  borradas as (
    delete from public.notificaciones_historial
      where id in (select id from numeradas where rn > 10)
      returning id
  )
  select count(*) into v_filas_borradas from borradas;

  return v_filas_borradas;
end;
$$;

comment on function public.purgar_notificaciones_historial() is
  'Pensada para ser ejecutada por un cron una vez al dia: por cada usuario_id de public.notificaciones_historial, conserva solo las 10 filas mas recientes segun created_at y borra el resto. No valida propiedad ni auth.uid(): la invoca el sistema, no un usuario concreto. Devuelve el numero de filas borradas en la ejecucion.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: ninguno para roles de cliente.
--    Igual que autocancelar_clases_sin_minimo(), solo debe poder ejecutarla
--    el propio sistema (cron/postgres), nunca desde el cliente.
-- ----------------------------------------------------------------------------
revoke all on function public.purgar_notificaciones_historial() from public;


-- ----------------------------------------------------------------------------
-- 3) Cron: ejecuta purgar_notificaciones_historial() una vez al día, a las
--    4:00 UTC (hora de baja actividad). cron.schedule con el mismo nombre
--    re-ejecuta de forma idempotente (actualiza el job).
-- ----------------------------------------------------------------------------
select cron.schedule(
  'purgar-notificaciones-historial',
  '0 4 * * *',
  $$ select purgar_notificaciones_historial(); $$
);
