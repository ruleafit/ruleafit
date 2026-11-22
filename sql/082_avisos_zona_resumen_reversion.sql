-- ============================================================================
-- Ruleafit · 082_avisos_zona_resumen_reversion.sql
-- Deshace sql/082_avisos_zona_resumen.sql. NO EJECUTADO. Ejecución manual.
--
-- Borra las 4 funciones y las 2 tablas de estado/errores del resumen. NO borra
-- avisos_zona_resumenes (Fase 1) ni las notificaciones ya generadas (son normales).
-- Para APAGAR sin destruir nada basta:  update public.config_avisos_zona set resumen_activo = false;
-- Orden: 1) dar de baja el cron (sql/082_avisos_zona_resumen_cron_baja.sql); 2) este archivo.
-- Se detiene sin borrar nada si el cron sigue programado.
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'avisos-zona-resumen') then
    raise exception 'Da de baja antes el cron avisos-zona-resumen (sql/082_avisos_zona_resumen_cron_baja.sql)';
  end if;
end;
$$;

drop function if exists public.avisos_zona_estado_resumen();
drop function if exists public.procesar_avisos_zona_resumen(timestamptz);
drop function if exists public.generar_resumen_zona(uuid, date, timestamptz);
drop function if exists public.avisos_zona_sesiones_resumen(uuid, date, timestamptz);

drop table if exists public.avisos_zona_resumen_errores;
drop table if exists public.avisos_zona_resumen_motor;

commit;

-- Comprobación: 0 filas.
select 'objeto' as tipo, p.proname as nombre
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('avisos_zona_sesiones_resumen', 'generar_resumen_zona', 'procesar_avisos_zona_resumen', 'avisos_zona_estado_resumen')
union all
select 'tabla', c.relname
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('avisos_zona_resumen_motor', 'avisos_zona_resumen_errores');
