-- ============================================================================
-- Ruleafit · 081_avisos_zona_inmediatos_reversion.sql
-- Deshace sql/081_avisos_zona_inmediatos.sql. NO EJECUTADO. Ejecución manual.
--
-- ⚠ Borra el estado del motor y el registro de pendientes/agotados. NO borra las
-- tablas de la Fase 1 (avisos_zona_inmediatos, avisos_zona_procesadas...), ni los
-- avisos ya generados en el historial o la cola (son notificaciones normales).
-- Para APAGAR sin destruir nada basta:
--   update public.config_avisos_zona set inmediatos_activos = false;
--
-- Orden: 1) dar de baja el cron (sql/081_avisos_zona_inmediatos_cron_baja.sql);
--        2) ejecutar este archivo. Se detiene (sin borrar nada) si el cron sigue.
-- No toca generar_notificacion, favoritos, reservas, cancelaciones ni recordatorios.
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-inmediatos') then
    raise exception 'Da de baja antes el cron avisos-zona-inmediatos (sql/081_avisos_zona_inmediatos_cron_baja.sql)';
  end if;
end;
$$;

drop function if exists public.avisos_zona_reintentar_agotados(uuid);
drop function if exists public.avisos_zona_estado_motor();
drop function if exists public.procesar_avisos_zona_inmediatos(timestamptz);
drop function if exists public.avisos_zona_procesar_sesion(uuid, timestamptz);
drop function if exists public.generar_aviso_zona(uuid, uuid, timestamptz);
drop function if exists public.avisos_zona_texto_cuerpo(text, text, date, time, text);

drop table if exists public.avisos_zona_pendientes;
drop table if exists public.avisos_zona_motor;

commit;

-- Comprobación: debe devolver 0 filas.
select 'objeto' as tipo, p.proname as nombre
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'avisos_zona_procesar_sesion',
                     'avisos_zona_estado_motor', 'avisos_zona_reintentar_agotados', 'avisos_zona_texto_cuerpo')
union all
select 'tabla', c.relname
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relname in ('avisos_zona_motor', 'avisos_zona_pendientes');
