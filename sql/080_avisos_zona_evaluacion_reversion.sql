-- ============================================================================
-- Ruleafit · 080_avisos_zona_evaluacion_reversion.sql
-- Deshace sql/080_avisos_zona_evaluacion.sql. NO EJECUTADO. Ejecución manual.
--
-- No es destructivo para datos: solo elimina la función de evaluación en seco,
-- que no escribe nada y de la que no depende ningún cron, trigger ni tabla.
-- No toca sql/079 (tablas y funciones auxiliares) ni nada de lo existente.
-- Se detiene si encuentra funciones de fases posteriores que podrían llamarla.
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
                       'enviar_resumenes_zona');
  if v_pendientes is not null then
    raise exception 'Borra antes las funciones de fases posteriores: %', v_pendientes;
  end if;
end;
$$;

drop function if exists public.avisos_zona_evaluar(uuid, timestamptz, boolean);

commit;

-- Comprobación: debe devolver 0 filas.
select p.proname
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar';
