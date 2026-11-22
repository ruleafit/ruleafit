-- ============================================================================
-- Ruleafit · 083_avisos_zona_mantenimiento_reversion.sql · NO EJECUTADO.
-- Deshace sql/083: restaura la purga del historial de sql/056 (10 últimas por usuario,
-- sin distinguir tipos) y borra la función de limpieza de control.
-- Orden: 1) baja del cron avisos-zona-purga; 2) este archivo (se detiene si sigue).
-- ============================================================================
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-purga') then
    raise exception 'Da de baja antes el cron avisos-zona-purga (sql/083_avisos_zona_mantenimiento_cron_baja.sql)';
  end if;
end;
$$;

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

drop function if exists public.avisos_zona_purgar_control(timestamptz);

commit;
