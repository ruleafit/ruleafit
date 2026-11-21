-- ============================================================================
-- Ruleafit · 081_avisos_zona_inmediatos_verificacion.sql
-- Para ejecutar DESPUÉS de aplicar sql/081_avisos_zona_inmediatos.sql (y ANTES de
-- programar el cron). SOLO LECTURA. Una única consulta; todas las filas deben
-- tener ok = true.
--
-- Las huellas (md5) del grupo 6 son las de las funciones existentes y de las
-- Fases 1 y 3 el 21 nov 2026, antes de la Fase 4. Si alguien las cambió a propósito
-- después, esas filas darán false por ese motivo y no por el 081.
-- ============================================================================

select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (

  -- 1) Tablas nuevas con RLS
  select 1 as orden, 'RLS activada: ' || c.relname as comprobacion, c.relrowsecurity::text as obtenido, 'true' as esperado
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('avisos_zona_motor', 'avisos_zona_pendientes')
  union all
  select 1, 'Existen las 2 tablas nuevas', count(*)::text, '2'
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('avisos_zona_motor', 'avisos_zona_pendientes')

  -- 2) Permisos de las tablas: la web no accede a ninguna
  union all
  select 2, 'anon sin permisos en ' || t.nombre,
         has_table_privilege('anon', 'public.' || t.nombre, 'select,insert,update,delete,truncate,references,trigger')::text, 'false'
    from (values ('avisos_zona_motor'), ('avisos_zona_pendientes')) as t(nombre)
  union all
  select 2, 'authenticated sin permisos en ' || t.nombre,
         has_table_privilege('authenticated', 'public.' || t.nombre, 'select,insert,update,delete,truncate,references,trigger')::text, 'false'
    from (values ('avisos_zona_motor'), ('avisos_zona_pendientes')) as t(nombre)

  -- 3) Funciones nuevas: solo la clave de servicio, blindadas
  union all
  select 3, 'Funciones nuevas creadas (6)', count(*)::text, '6'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'avisos_zona_procesar_sesion',
                       'avisos_zona_estado_motor', 'avisos_zona_reintentar_agotados', 'avisos_zona_texto_cuerpo')
  union all
  select 3, 'Ejecutables por anon/authenticated', count(*) filter (where has_function_privilege('anon', p.oid, 'execute')
                                                                     or has_function_privilege('authenticated', p.oid, 'execute'))::text, '0'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'avisos_zona_procesar_sesion',
                       'avisos_zona_estado_motor', 'avisos_zona_reintentar_agotados', 'avisos_zona_texto_cuerpo')
  union all
  select 3, 'Ejecutables por service_role', count(*) filter (where has_function_privilege('service_role', p.oid, 'execute'))::text, '6'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'avisos_zona_procesar_sesion',
                       'avisos_zona_estado_motor', 'avisos_zona_reintentar_agotados', 'avisos_zona_texto_cuerpo')
  union all
  select 3, 'Todas con search_path fijo',
         count(*) filter (where p.proconfig is not null and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text, '6'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'avisos_zona_procesar_sesion',
                       'avisos_zona_estado_motor', 'avisos_zona_reintentar_agotados', 'avisos_zona_texto_cuerpo')
  union all
  select 3, 'Motor y aviso son SECURITY DEFINER', count(*) filter (where p.prosecdef)::text, '2'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos')

  -- 4) Estado inicial: TODO apagado y sin procesos
  union all select 4, 'Interruptor inmediatos apagado', inmediatos_activos::text, 'false' from public.config_avisos_zona
  union all select 4, 'Interruptor resumen apagado', resumen_activo::text, 'false' from public.config_avisos_zona
  union all select 4, 'Modo prueba activo', solo_usuarios_prueba::text, 'true' from public.config_avisos_zona
  union all select 4, 'Usuarios de prueba (lista vacía)', cardinality(usuarios_prueba)::text, '0' from public.config_avisos_zona
  union all select 4, 'Fila del motor existente', count(*)::text, '1' from public.avisos_zona_motor
  union all select 4, 'Motor: activo_visto = false', activo_visto::text, 'false' from public.avisos_zona_motor
  union all select 4, 'Motor: cursor no está en el futuro', (cursor_at <= now())::text, 'true' from public.avisos_zona_motor
  union all select 4, 'Crons de avisos de zona (antes de programar)', count(*)::text, '0' from cron.job where jobname ilike '%avisos%'
  union all select 4, 'Triggers de avisos en public.clases', count(*)::text, '0'
    from pg_trigger t where t.tgrelid = 'public.clases'::regclass and not t.tgisinternal and t.tgname ilike '%avisos%'
  union all select 4, 'Pendientes registrados', count(*)::text, '0' from public.avisos_zona_pendientes
  union all select 4, 'Sesiones procesadas', count(*)::text, '0' from public.avisos_zona_procesadas
  union all select 4, 'Avisos inmediatos registrados', count(*)::text, '0' from public.avisos_zona_inmediatos
  union all select 4, 'Notificaciones de zona en cola', count(*)::text, '0' from public.notificaciones_cola where tipo like '%zona%'
  union all select 4, 'Notificaciones de zona en historial', count(*)::text, '0' from public.notificaciones_historial where tipo like '%zona%'

  -- 5) Funcionamiento básico de solo lectura
  union all select 5, 'Texto del aviso',
         public.avisos_zona_texto_cuerpo('HIIT  ', 'Sevilla', date '2026-12-05', time '18:00', 'ana'), 'HIIT · Sevilla · sáb 5 dic, 18:00 (de @ana)'
  union all select 5, 'Diagnóstico del motor devuelve el estado',
         ((public.avisos_zona_estado_motor() -> 'motor') is not null)::text, 'true'

  -- 6) Funciones EXISTENTES y de las Fases 1 y 3 intactas
  union all
  select 6, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
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
      ('avisos_zona_antes_de_guardar',    '915ea925dbd0454c49eb9ef7bc229c4c'),
      ('avisos_zona_corte_resumen',       '3f3b59b4f16e2b4749c4017111b1fda6'),
      ('avisos_zona_dia_de_resumen',      'c76e285f001421fec0a9da28a934b838'),
      ('avisos_zona_dia_madrid',          '0e95b1383adead2708b21bc45fcb9449'),
      ('avisos_zona_distancia_km',        'ad82f05cd3e7caf2b00492ed26670c8c'),
      ('avisos_zona_en_franja',           'aceb6a6470111209a16a1e87a179f793'),
      ('avisos_zona_en_horizonte',        '13130b56458890dbf0bfc986dc21960f'),
      ('avisos_zona_inicio_sesion',       'd504bfd0b8f9a84fabae9a5713b19f4b'),
      ('avisos_zona_tocar_updated_at',    'df3ff4ccb003ee10bd50b25a7583517b'),
      ('avisos_zona_ventana_resumen',     'aa1219e9a012490c7e6514aaf8a13bfc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace

) comprobaciones
order by orden, comprobacion;


-- ----------------------------------------------------------------------------
-- OPCIONAL (ejecutar por separado, solo lectura): estado del motor y errores.
-- ----------------------------------------------------------------------------
-- select jsonb_pretty(public.avisos_zona_estado_motor());
