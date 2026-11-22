-- Ruleafit · 083_avisos_zona_mantenimiento_verificacion.sql
-- SOLO LECTURA. Ejecutar tras aplicar sql/083_avisos_zona_mantenimiento.sql. Todas las filas ok = true.
select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (
  select 1 as orden, 'Existe avisos_zona_purgar_control' as comprobacion, count(*)::text as obtenido, '1' as esperado
    from pg_proc where pronamespace = 'public'::regnamespace and proname = 'avisos_zona_purgar_control'
  union all
  select 1, 'Purga de control: solo service_role, SECURITY DEFINER, search_path fijo',
         (has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
          and not has_function_privilege('authenticated', p.oid, 'execute') and p.prosecdef
          and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text, 'true'
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_purgar_control'
  union all
  select 2, 'Purga del historial incluye cuota de zona',
         (pg_get_functiondef(p.oid) like '%resumen_zona%' and pg_get_functiondef(p.oid) like '%rn > 5%')::text, 'true'
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'purgar_notificaciones_historial'
  union all
  select 2, 'Purga del historial: sigue sin ejecutable por anon/authenticated',
         (not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute'))::text, 'true'
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'purgar_notificaciones_historial'
  union all select 3, 'Cron de limpieza aún sin programar', count(*)::text, '0' from cron.job where jobname = 'avisos-zona-purga'
  union all select 3, 'Cron purgar-notificaciones-historial intacto', count(*)::text, '1' from cron.job where jobname = 'purgar-notificaciones-historial' and schedule = '0 4 * * *' and active
  union all select 3, 'Interruptor inmediatos apagado', inmediatos_activos::text, 'false' from public.config_avisos_zona
  union all select 3, 'Interruptor resumen apagado', resumen_activo::text, 'false' from public.config_avisos_zona
  union all
  select 4, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
    from pg_proc p join (values
      ('generar_notificacion',         '111e8b5bab94cee59736c57fbffb5296'),
      ('notificar_publicacion_clase',  '38f70675f0e3a6b444d07d47eb93d11a'),
      ('procesar_recordatorios',       'f9d3e448bdfa891f177d0888dce2a4dc'),
      ('cancelar_clase',               '5e9dcca65397ff7c92d1363e5aa3e4a5'),
      ('cancelar_reserva',             '08f3a5dd91c2283a991cc53dfe8a4362'),
      ('reservar_clase',               '843591d994ce30fac5d051afe5e44cbc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace
) c order by orden, comprobacion;
