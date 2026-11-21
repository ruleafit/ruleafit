-- ============================================================================
-- Ruleafit · 079_avisos_zona_reversion.sql
-- Deshace sql/079_avisos_zona_base.sql. NO EJECUTADO. Ejecución manual.
--
-- ⚠ DESTRUCTIVO: borra la configuración de zona de TODOS los usuarios y los
-- registros de control. Solo tiene sentido si aún no se ha usado la
-- funcionalidad o se quiere eliminar del todo.
--
-- ANTES DE BORRAR, lo habitual es APAGAR (no destruye nada, deja de avisar):
--   update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;
-- Con eso ningún aviso sale aunque existan los datos y las funciones.
--
-- Orden seguro:
--   1. Desprogramar los crons de avisos (fases 4 y 5), si existen:
--        select cron.unschedule(jobname) from cron.job where jobname like 'avisos-zona%';
--   2. Borrar las funciones de fases posteriores, si existen (generar_aviso_zona,
--      procesar_avisos_zona_inmediatos, enviar_resumenes_zona...).
--   3. Ejecutar este archivo.
--
-- Este archivo se detiene (sin borrar nada) si encuentra crons o funciones de
-- fases posteriores todavía presentes. No toca generar_notificacion, favoritos,
-- reservas, cancelaciones ni recordatorios.
-- ============================================================================

begin;

do $$
declare
  v_pendientes text;
begin
  select string_agg(jobname, ', ') into v_pendientes
    from cron.job
   where jobname like 'avisos-zona%';
  if v_pendientes is not null then
    raise exception 'Desprograma antes los crons de avisos de zona: %', v_pendientes;
  end if;

  select string_agg(p.proname, ', ') into v_pendientes
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos',
                       'enviar_resumenes_zona', 'purgar_avisos_zona');
  if v_pendientes is not null then
    raise exception 'Borra antes las funciones de fases posteriores: %', v_pendientes;
  end if;
end;
$$;

-- Tablas (las políticas, índices y triggers de cada tabla caen con ella).
drop table if exists public.avisos_zona_resumenes;
drop table if exists public.avisos_zona_inmediatos;
drop table if exists public.avisos_zona_procesadas;
drop table if exists public.avisos_zona;
drop table if exists public.config_avisos_zona;

-- Funciones (solo las de esta fase).
drop function if exists public.avisos_zona_habilitado(uuid, text);
drop function if exists public.avisos_zona_en_franja(time, time, time);
drop function if exists public.avisos_zona_dia_de_resumen(timestamptz);
drop function if exists public.avisos_zona_ventana_resumen(date);
drop function if exists public.avisos_zona_corte_resumen(date);
drop function if exists public.avisos_zona_dia_madrid(timestamptz);
drop function if exists public.avisos_zona_en_horizonte(date, time, timestamptz);
drop function if exists public.avisos_zona_inicio_sesion(date, time);
drop function if exists public.avisos_zona_distancia_km(double precision, double precision, double precision, double precision);
drop function if exists public.avisos_zona_antes_de_guardar();
drop function if exists public.avisos_zona_tocar_updated_at();

commit;

-- Comprobación: debe devolver 0 filas.
select 'tabla' as tipo, c.relname as nombre
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relname like '%avisos_zona%'
union all
select 'funcion', p.proname
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname like 'avisos_zona%';
