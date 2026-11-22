-- ============================================================================
-- Ruleafit · 083_avisos_zona_mantenimiento.sql
-- «Avisos de sesiones en mi zona» · FASE 6: historial y limpieza.
--
-- NO EJECUTADO. Aplicar solo con autorización expresa. No programa ningún cron
-- (el de limpieza va en sql/083_avisos_zona_mantenimiento_cron.sql, aparte).
--
-- 1) HISTORIAL DE LA CAMPANA. La purga diaria (sql/056) conserva las 10 últimas
--    notificaciones por usuario. Con avisos de zona, unos cuantos avisos seguidos
--    podrían expulsar reservas, cancelaciones o recordatorios. Se reemplaza por una
--    versión (MISMO nombre, firma y permisos: el cron existente no cambia) que
--    cuenta aparte:
--       · 10 notificaciones normales más recientes por usuario (como antes);
--       · 5 avisos de zona más recientes por usuario (sesion_zona, resumen_zona).
--    Para quien no tiene avisos de zona el comportamiento es idéntico al actual.
--    La web (lib/consultaNotificaciones.js) muestra 10 normales + 3 de zona.
--
-- 2) LIMPIEZA DE CONTROL: public.avisos_zona_purgar_control() borra solo registros
--    antiguos que ya no sirven para evitar duplicados ni recuperar errores:
--       avisos_zona_procesadas      > 30 días (procesada/descartada)
--       avisos_zona_inmediatos      > 14 días (el tope diario solo mira el día en curso)
--       avisos_zona_pendientes      resuelto/descartado > 30 días; agotado > 90 días
--       avisos_zona_resumen_errores > 30 días
--       avisos_zona_resumenes       > 60 días (las sesiones de un resumen empiezan en
--                                   <= 7 días; 60 conserva los enlaces de la campana)
--       notificaciones_cola         SOLO tipos de zona, enviadas o con error > 14 días
--    NO toca: configuración de usuarios (avisos_zona), config_avisos_zona, el estado
--    de los motores, notificaciones pendientes, ni notificaciones que no sean de zona.
--
-- Reversión: sql/083_avisos_zona_mantenimiento_reversion.sql (restaura la purga de
-- sql/056). Comprobación: sql/083_avisos_zona_mantenimiento_verificacion.sql.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Purga del historial con cuota separada para los avisos de zona
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
           (tipo in ('sesion_zona', 'resumen_zona')) as es_zona,
           row_number() over (
             partition by usuario_id, (tipo in ('sesion_zona', 'resumen_zona'))
             order by created_at desc, id desc
           ) as rn
      from public.notificaciones_historial
  ),
  borradas as (
    delete from public.notificaciones_historial
      where id in (select id from numeradas
                    where (not es_zona and rn > 10) or (es_zona and rn > 5))
      returning id
  )
  select count(*) into v_filas_borradas from borradas;

  return v_filas_borradas;
end;
$$;

comment on function public.purgar_notificaciones_historial() is
  'Cron diario: por usuario conserva las 10 notificaciones normales mas recientes y, aparte, los 5 avisos de zona (sesion_zona, resumen_zona) mas recientes. Devuelve las filas borradas. No valida auth.uid(): la invoca el sistema.';


-- ----------------------------------------------------------------------------
-- 2) Limpieza de las tablas de control de avisos de zona
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_purgar_control(p_ahora timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hoy   date := public.avisos_zona_dia_madrid(p_ahora);
  v_proc  integer; v_inm integer; v_pend integer; v_err integer; v_res integer; v_cola integer;
begin
  delete from public.avisos_zona_procesadas
   where estado in ('procesada', 'descartada') and actualizada_at < p_ahora - interval '30 days';
  get diagnostics v_proc = row_count;

  delete from public.avisos_zona_inmediatos where dia < v_hoy - 14;
  get diagnostics v_inm = row_count;

  delete from public.avisos_zona_pendientes
   where (estado in ('resuelto', 'descartado') and updated_at < p_ahora - interval '30 days')
      or (estado = 'agotado' and updated_at < p_ahora - interval '90 days');
  get diagnostics v_pend = row_count;

  delete from public.avisos_zona_resumen_errores where dia < v_hoy - 30;
  get diagnostics v_err = row_count;

  delete from public.avisos_zona_resumenes where dia < v_hoy - 60;
  get diagnostics v_res = row_count;

  delete from public.notificaciones_cola
   where tipo in ('sesion_zona', 'resumen_zona')
     and estado in ('enviada', 'error')
     and created_at < p_ahora - interval '14 days';
  get diagnostics v_cola = row_count;

  return jsonb_build_object('procesadas', v_proc, 'inmediatos', v_inm, 'pendientes', v_pend,
                            'errores_resumen', v_err, 'resumenes', v_res, 'cola_zona', v_cola);
end;
$$;

revoke all on function public.avisos_zona_purgar_control(timestamptz) from public, anon, authenticated;
grant execute on function public.avisos_zona_purgar_control(timestamptz) to service_role;

commit;
