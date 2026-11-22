-- ============================================================================
-- Ruleafit · 082_avisos_zona_resumen_verificacion.sql
-- Ejecutar DESPUÉS de aplicar sql/082_avisos_zona_resumen.sql (y ANTES de programar
-- el cron). SOLO LECTURA. Una consulta; todas las filas deben tener ok = true.
-- Las huellas (md5) del grupo 5 son las de las funciones existentes y de las fases
-- 1 y 3 el 21 nov 2026, antes de la Fase 4.
-- ============================================================================

select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (

  select 1 as orden, 'Existen las 2 tablas nuevas' as comprobacion, count(*)::text as obtenido, '2' as esperado
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('avisos_zona_resumen_motor', 'avisos_zona_resumen_errores')
  union all
  select 1, 'RLS activada: ' || c.relname, c.relrowsecurity::text, 'true'
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('avisos_zona_resumen_motor', 'avisos_zona_resumen_errores')

  union all
  select 2, 'anon sin permisos en ' || t.nombre,
         has_table_privilege('anon', 'public.' || t.nombre, 'select,insert,update,delete,truncate,references,trigger')::text, 'false'
    from (values ('avisos_zona_resumen_motor'), ('avisos_zona_resumen_errores')) as t(nombre)
  union all
  select 2, 'authenticated sin permisos en ' || t.nombre,
         has_table_privilege('authenticated', 'public.' || t.nombre, 'select,insert,update,delete,truncate,references,trigger')::text, 'false'
    from (values ('avisos_zona_resumen_motor'), ('avisos_zona_resumen_errores')) as t(nombre)

  union all
  select 3, 'Funciones nuevas creadas (4)', count(*)::text, '4'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('avisos_zona_sesiones_resumen', 'generar_resumen_zona', 'procesar_avisos_zona_resumen', 'avisos_zona_estado_resumen')
  union all
  select 3, 'Ejecutables por anon/authenticated', count(*) filter (where has_function_privilege('anon', p.oid, 'execute')
                                                                     or has_function_privilege('authenticated', p.oid, 'execute'))::text, '0'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('avisos_zona_sesiones_resumen', 'generar_resumen_zona', 'procesar_avisos_zona_resumen', 'avisos_zona_estado_resumen')
  union all
  select 3, 'Ejecutables por service_role', count(*) filter (where has_function_privilege('service_role', p.oid, 'execute'))::text, '4'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('avisos_zona_sesiones_resumen', 'generar_resumen_zona', 'procesar_avisos_zona_resumen', 'avisos_zona_estado_resumen')
  union all
  select 3, 'Todas SECURITY DEFINER con search_path fijo',
         count(*) filter (where p.prosecdef and p.proconfig is not null
                            and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text, '4'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('avisos_zona_sesiones_resumen', 'generar_resumen_zona', 'procesar_avisos_zona_resumen', 'avisos_zona_estado_resumen')

  union all select 4, 'Interruptor inmediatos apagado', inmediatos_activos::text, 'false' from public.config_avisos_zona
  union all select 4, 'Interruptor resumen apagado', resumen_activo::text, 'false' from public.config_avisos_zona
  union all select 4, 'Modo prueba activo', solo_usuarios_prueba::text, 'true' from public.config_avisos_zona
  union all select 4, 'Usuarios de prueba (lista vacía)', cardinality(usuarios_prueba)::text, '0' from public.config_avisos_zona
  union all select 4, 'Fila del estado del resumen', count(*)::text, '1' from public.avisos_zona_resumen_motor
  union all select 4, 'Crons del resumen (antes de programar)', count(*)::text, '0' from cron.job where jobname = 'avisos-zona-resumen'
  union all select 4, 'Resúmenes generados', count(*)::text, '0' from public.avisos_zona_resumenes
  union all select 4, 'Errores registrados', count(*)::text, '0' from public.avisos_zona_resumen_errores
  union all select 4, 'Notificaciones resumen_zona en cola', count(*)::text, '0' from public.notificaciones_cola where tipo = 'resumen_zona'
  union all select 4, 'Notificaciones resumen_zona en historial', count(*)::text, '0' from public.notificaciones_historial where tipo = 'resumen_zona'
  union all select 4, 'Triggers de avisos en public.clases', count(*)::text, '0'
    from pg_trigger t where t.tgrelid = 'public.clases'::regclass and not t.tgisinternal and t.tgname ilike '%avisos%'
  union all select 4, 'Diagnóstico del resumen devuelve el estado',
         ((public.avisos_zona_estado_resumen() -> 'motor') is not null)::text, 'true'

  -- Funciones existentes y de fases anteriores intactas (huellas del 21 nov 2026)
  union all
  select 5, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
    from pg_proc p
    join (values
      ('autocancelar_clases_sin_minimo',  'b2f7610d68c7b2873f486b6f92030759'),
      ('cancelar_clase',                  '5e9dcca65397ff7c92d1363e5aa3e4a5'),
      ('cancelar_reserva',                '08f3a5dd91c2283a991cc53dfe8a4362'),
      ('generar_notificacion',            '111e8b5bab94cee59736c57fbffb5296'),
      ('impedir_reserva_si_bloqueado',    '887952e542d411b90ae6d9e0f435b810'),
      ('notificar_publicacion_clase',     '38f70675f0e3a6b444d07d47eb93d11a'),
      ('procesar_recordatorios',          'f9d3e448bdfa891f177d0888dce2a4dc'),
      ('purgar_notificaciones_historial', '4341c2cc5ce7845f32345655c5a40772'),
      ('reservar_clase',                  '843591d994ce30fac5d051afe5e44cbc'),
      ('avisos_zona_evaluar',             '16b34f63d405454ede52e9fbfd84da70'),
      ('avisos_zona_habilitado',          '2f4449aac3e93f5fef4d558cf2927a1e'),
      ('avisos_zona_corte_resumen',       '3f3b59b4f16e2b4749c4017111b1fda6'),
      ('avisos_zona_dia_de_resumen',      'c76e285f001421fec0a9da28a934b838'),
      ('avisos_zona_ventana_resumen',     'aa1219e9a012490c7e6514aaf8a13bfc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace

) comprobaciones
order by orden, comprobacion;
