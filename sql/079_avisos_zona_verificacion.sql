-- ============================================================================
-- Ruleafit · 079_avisos_zona_verificacion.sql
-- Comprobaciones para ejecutar DESPUÉS de aplicar sql/079_avisos_zona_base.sql.
-- SOLO LECTURA: no crea ni modifica nada. Una única consulta (el SQL Editor solo
-- muestra el resultado de la última), con una fila por comprobación.
-- TODAS las filas deben tener ok = true.
--
-- Las filas del grupo 12 comparan con la huella (md5) que tenían las funciones
-- existentes el 21 nov 2026 ANTES de aplicar el 079. Si alguien las cambió a
-- propósito después, esas filas darán false por ese motivo y no por el 079.
-- ============================================================================

select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (

  -- 1) Las 5 tablas existen con RLS activada
  select 1 as orden, 'RLS activada: ' || c.relname as comprobacion,
         c.relrowsecurity::text as obtenido, 'true' as esperado
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('config_avisos_zona', 'avisos_zona', 'avisos_zona_procesadas',
                       'avisos_zona_inmediatos', 'avisos_zona_resumenes')
  union all
  select 1, 'Existen las 5 tablas', count(*)::text, '5'
    from pg_class c
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('config_avisos_zona', 'avisos_zona', 'avisos_zona_procesadas',
                       'avisos_zona_inmediatos', 'avisos_zona_resumenes')

  -- 2) Número de políticas RLS por tabla
  union all
  select 2, 'Políticas en ' || t.nombre,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.nombre)::text,
         t.esperadas::text
    from (values ('avisos_zona', 4), ('avisos_zona_resumenes', 1), ('avisos_zona_procesadas', 0),
                 ('avisos_zona_inmediatos', 0), ('config_avisos_zona', 0)) as t(nombre, esperadas)

  -- 3) anon no tiene NINGÚN permiso sobre las tablas nuevas
  union all
  select 3, 'anon sin permisos en ' || t.nombre,
         has_table_privilege('anon', 'public.' || t.nombre,
                             'select,insert,update,delete,truncate,references,trigger')::text,
         'false'
    from (values ('avisos_zona'), ('avisos_zona_resumenes'), ('avisos_zona_procesadas'),
                 ('avisos_zona_inmediatos'), ('config_avisos_zona')) as t(nombre)

  -- 4) authenticated en avisos_zona: lo mínimo y sin escribir columnas de servidor
  union all select 4, 'authenticated puede leer avisos_zona',
         has_table_privilege('authenticated', 'public.avisos_zona', 'select')::text, 'true'
  union all select 4, 'authenticated puede borrar su fila',
         has_table_privilege('authenticated', 'public.avisos_zona', 'delete')::text, 'true'
  union all select 4, 'authenticated puede insertar (por columnas)',
         has_any_column_privilege('authenticated', 'public.avisos_zona', 'insert')::text, 'true'
  union all select 4, 'authenticated NO tiene insert a nivel de tabla',
         has_table_privilege('authenticated', 'public.avisos_zona', 'insert')::text, 'false'
  union all select 4, 'authenticated puede editar la columna activo',
         has_column_privilege('authenticated', 'public.avisos_zona', 'activo', 'update')::text, 'true'
  union all select 4, 'authenticated NO puede editar activo_desde',
         has_column_privilege('authenticated', 'public.avisos_zona', 'activo_desde', 'update')::text, 'false'
  union all select 4, 'authenticated NO puede escribir activo_desde al insertar',
         has_column_privilege('authenticated', 'public.avisos_zona', 'activo_desde', 'insert')::text, 'false'
  union all select 4, 'authenticated NO puede editar created_at',
         has_column_privilege('authenticated', 'public.avisos_zona', 'created_at', 'update')::text, 'false'
  union all select 4, 'authenticated NO tiene truncate/references/trigger',
         has_table_privilege('authenticated', 'public.avisos_zona', 'truncate,references,trigger')::text, 'false'

  -- 5) Tablas de control: la web no accede; solo lee sus resúmenes
  union all
  select 5, 'authenticated sin permisos en ' || t.nombre,
         has_table_privilege('authenticated', 'public.' || t.nombre,
                             'select,insert,update,delete,truncate,references,trigger')::text,
         'false'
    from (values ('avisos_zona_procesadas'), ('avisos_zona_inmediatos'), ('config_avisos_zona')) as t(nombre)
  union all select 5, 'authenticated lee avisos_zona_resumenes',
         has_table_privilege('authenticated', 'public.avisos_zona_resumenes', 'select')::text, 'true'
  union all select 5, 'authenticated NO escribe en avisos_zona_resumenes',
         has_table_privilege('authenticated', 'public.avisos_zona_resumenes', 'insert,update,delete,truncate')::text, 'false'

  -- 6) Funciones: ni anon ni authenticated; sí la clave de servicio
  union all
  select 6, 'Funciones avisos_zona_* ejecutables por anon/authenticated',
         count(*) filter (where has_function_privilege('anon', p.oid, 'execute')
                             or has_function_privilege('authenticated', p.oid, 'execute'))::text,
         '0'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'avisos_zona%'
  union all
  select 6, 'Funciones auxiliares (no trigger) ejecutables por service_role',
         count(*) filter (where has_function_privilege('service_role', p.oid, 'execute')
                            and p.proname not in ('avisos_zona_tocar_updated_at', 'avisos_zona_antes_de_guardar'))::text,
         '9'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'avisos_zona%'
  union all
  select 6, 'Funciones avisos_zona_* creadas (9 + 2 de trigger)',
         count(*)::text, '11'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'avisos_zona%'
  union all
  select 6, 'Funciones con search_path fijo',
         count(*) filter (where p.proconfig is not null
                            and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text,
         '11'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'avisos_zona%'

  -- 7) Interruptor global: una fila, todo apagado, modo prueba, tope 5
  union all select 7, 'config: filas', count(*)::text, '1' from public.config_avisos_zona
  union all select 7, 'config: inmediatos apagados', inmediatos_activos::text, 'false' from public.config_avisos_zona
  union all select 7, 'config: resumen apagado', resumen_activo::text, 'false' from public.config_avisos_zona
  union all select 7, 'config: solo usuarios de prueba', solo_usuarios_prueba::text, 'true' from public.config_avisos_zona
  union all select 7, 'config: tope inmediatos por usuario y día', tope_inmediatos_usuario_dia::text, '5' from public.config_avisos_zona
  union all select 7, 'avisos_zona_habilitado apagado (inmediato)',
         public.avisos_zona_habilitado(gen_random_uuid(), 'inmediato')::text, 'false'
  union all select 7, 'avisos_zona_habilitado apagado (resumen)',
         public.avisos_zona_habilitado(gen_random_uuid(), 'resumen')::text, 'false'

  -- 8) Restricciones y claves
  union all
  select 8, 'Restricciones CHECK de avisos_zona (6 de columna + 3 nombradas)',
         (select count(*) from pg_constraint where conrelid = 'public.avisos_zona'::regclass and contype = 'c')::text,
         '9'
  union all
  select 8, 'Clave única de un aviso por usuario/organizador/día',
         (select count(*) from pg_constraint
           where conrelid = 'public.avisos_zona_inmediatos'::regclass and contype = 'p'
             and pg_get_constraintdef(oid) = 'PRIMARY KEY (usuario_id, organizador_id, dia)')::text,
         '1'
  union all
  select 8, 'Clave única de un resumen por usuario y día',
         (select count(*) from pg_constraint
           where conrelid = 'public.avisos_zona_resumenes'::regclass and contype = 'u'
             and pg_get_constraintdef(oid) = 'UNIQUE (usuario_id, dia)')::text,
         '1'
  union all
  select 8, 'Una fila por sesión en avisos_zona_procesadas (PK)',
         (select count(*) from pg_constraint
           where conrelid = 'public.avisos_zona_procesadas'::regclass and contype = 'p')::text,
         '1'
  union all
  select 8, 'Claves foráneas de las 4 tablas de usuario/control (6)',
         (select count(*) from pg_constraint
           where contype = 'f'
             and conrelid in ('public.avisos_zona'::regclass, 'public.avisos_zona_procesadas'::regclass,
                              'public.avisos_zona_inmediatos'::regclass, 'public.avisos_zona_resumenes'::regclass))::text,
         '6'

  -- 9) No hay crons ni triggers de avisos sobre tablas existentes
  union all
  select 9, 'Crons de avisos de zona', count(*)::text, '0'
    from cron.job where jobname ilike '%avisos%'
  union all
  select 9, 'Triggers nuevos en public.clases (nombre avisos)',
         count(*)::text, '0'
    from pg_trigger t
   where t.tgrelid = 'public.clases'::regclass and not t.tgisinternal and t.tgname ilike '%avisos%'
  union all
  select 9, 'Triggers en las tablas nuevas (config 1 + avisos_zona 1)',
         count(*)::text, '2'
    from pg_trigger t
   where not t.tgisinternal
     and t.tgrelid in ('public.config_avisos_zona'::regclass, 'public.avisos_zona'::regclass)

  -- 10) Distancia (haversine)
  union all select 10, 'Sevilla–Madrid entre 388 y 393 km',
         (public.avisos_zona_distancia_km(37.3891, -5.9845, 40.4168, -3.7038) between 388 and 393)::text, 'true'
  union all select 10, 'Mismo punto = 0 km',
         public.avisos_zona_distancia_km(37, -6, 37, -6)::text, '0'
  union all select 10, '0,009° de latitud ≈ 1 km',
         (public.avisos_zona_distancia_km(37, -6, 37.009, -6) between 0.99 and 1.01)::text, 'true'
  union all select 10, 'Simétrica',
         (public.avisos_zona_distancia_km(37.3891, -5.9845, 40.4168, -3.7038)
          = public.avisos_zona_distancia_km(40.4168, -3.7038, 37.3891, -5.9845))::text, 'true'
  union all select 10, 'Entrada nula = nulo',
         (public.avisos_zona_distancia_km(null, -6, 37, -6) is null)::text, 'true'

  -- 11) Horizonte de EXACTAMENTE 168 horas, también al cambiar el horario
  --     Primavera 2027 (el 28 mar se salta una hora): desde las 12:00 locales del 24 mar,
  --     168 h exactas llegan a las 13:00 locales del 31 mar.
  union all select 11, 'Primavera: 31 mar 13:00 local (límite exacto) dentro',
         public.avisos_zona_en_horizonte(date '2027-03-31', time '13:00', timestamptz '2027-03-24 11:00:00+00')::text, 'true'
  union all select 11, 'Primavera: 31 mar 13:01 local fuera',
         public.avisos_zona_en_horizonte(date '2027-03-31', time '13:01', timestamptz '2027-03-24 11:00:00+00')::text, 'false'
  --     Otoño 2027 (el 31 oct sobra una hora): desde las 12:00 locales del 28 oct,
  --     168 h exactas llegan a las 11:00 locales del 4 nov.
  union all select 11, 'Otoño: 4 nov 11:00 local (límite exacto) dentro',
         public.avisos_zona_en_horizonte(date '2027-11-04', time '11:00', timestamptz '2027-10-28 10:00:00+00')::text, 'true'
  union all select 11, 'Otoño: 4 nov 11:01 local fuera',
         public.avisos_zona_en_horizonte(date '2027-11-04', time '11:01', timestamptz '2027-10-28 10:00:00+00')::text, 'false'
  union all select 11, 'Otoño: 4 nov 12:00 local (7 días de calendario) fuera',
         public.avisos_zona_en_horizonte(date '2027-11-04', time '12:00', timestamptz '2027-10-28 10:00:00+00')::text, 'false'
  union all select 11, 'Sesión que empieza justo ahora NO entra (estrictamente futura)',
         public.avisos_zona_en_horizonte(date '2026-11-21', time '20:00', timestamptz '2026-11-21 19:00:00+00')::text, 'false'
  union all select 11, 'Sesión 1 minuto después entra',
         public.avisos_zona_en_horizonte(date '2026-11-21', time '20:01', timestamptz '2026-11-21 19:00:00+00')::text, 'true'
  union all select 11, 'Sesión ya empezada no entra',
         public.avisos_zona_en_horizonte(date '2026-11-21', time '19:00', timestamptz '2026-11-21 19:00:00+00')::text, 'false'

  -- 12) 20:30 de Madrid, ventana del resumen, día de Madrid y franja
  union all select 12, '20:30 Madrid 27 mar 2027 = 19:30 UTC',
         to_char(public.avisos_zona_corte_resumen(date '2027-03-27') at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '2027-03-27 19:30'
  union all select 12, '20:30 Madrid 28 mar 2027 = 18:30 UTC',
         to_char(public.avisos_zona_corte_resumen(date '2027-03-28') at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '2027-03-28 18:30'
  union all select 12, '20:30 Madrid 30 oct 2027 = 18:30 UTC',
         to_char(public.avisos_zona_corte_resumen(date '2027-10-30') at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '2027-10-30 18:30'
  union all select 12, '20:30 Madrid 31 oct 2027 = 19:30 UTC',
         to_char(public.avisos_zona_corte_resumen(date '2027-10-31') at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '2027-10-31 19:30'
  union all select 12, 'Ventana del 28 mar 2027 dura 23 h',
         (select (hasta - desde)::text from public.avisos_zona_ventana_resumen(date '2027-03-28')), '23:00:00'
  union all select 12, 'Ventana del 31 oct 2027 dura 25 h',
         (select (hasta - desde)::text from public.avisos_zona_ventana_resumen(date '2027-10-31')), '1 day 01:00:00'
  union all select 12, 'Ventana de un día normal dura 24 h',
         (select (hasta - desde)::text from public.avisos_zona_ventana_resumen(date '2027-06-10')), '1 day'
  union all select 12, 'Resumen: invierno 20:29:59 aún no toca',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2026-11-21 19:29:59+00')::text, 'nulo'), 'nulo'
  union all select 12, 'Resumen: invierno 20:30 toca',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2026-11-21 19:30:00+00')::text, 'nulo'), '2026-11-21'
  union all select 12, 'Resumen: invierno 22:29:59 aún se recupera',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2026-11-21 21:29:59+00')::text, 'nulo'), '2026-11-21'
  union all select 12, 'Resumen: invierno 22:30 ya no',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2026-11-21 21:30:00+00')::text, 'nulo'), 'nulo'
  union all select 12, 'Resumen: verano 20:29:59 aún no toca',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2027-07-15 18:29:59+00')::text, 'nulo'), 'nulo'
  union all select 12, 'Resumen: verano 20:30 toca',
         coalesce(public.avisos_zona_dia_de_resumen(timestamptz '2027-07-15 18:30:00+00')::text, 'nulo'), '2027-07-15'
  union all select 12, 'Día de Madrid: 23:30 UTC de invierno ya es el día siguiente',
         public.avisos_zona_dia_madrid(timestamptz '2026-11-21 23:30:00+00')::text, '2026-11-22'
  union all select 12, 'Día de Madrid: 21:59 UTC de verano sigue siendo el mismo día',
         public.avisos_zona_dia_madrid(timestamptz '2027-07-15 21:59:00+00')::text, '2027-07-15'
  union all select 12, 'Día de Madrid: 22:00 UTC de verano ya es el día siguiente',
         public.avisos_zona_dia_madrid(timestamptz '2027-07-15 22:00:00+00')::text, '2027-07-16'
  union all select 12, 'Franja: 16:00 incluida',
         public.avisos_zona_en_franja(time '16:00', time '16:00', time '22:00')::text, 'true'
  union all select 12, 'Franja: 22:00 incluida',
         public.avisos_zona_en_franja(time '22:00', time '16:00', time '22:00')::text, 'true'
  union all select 12, 'Franja: 22:01 fuera',
         public.avisos_zona_en_franja(time '22:01', time '16:00', time '22:00')::text, 'false'
  union all select 12, 'Franja: 15:59 fuera',
         public.avisos_zona_en_franja(time '15:59', time '16:00', time '22:00')::text, 'false'

  -- 13) Funciones EXISTENTES intactas (huella md5 del 21 nov 2026)
  union all
  select 13, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
    from pg_proc p
    join (values
      ('autocancelar_clases_sin_minimo', 'b2f7610d68c7b2873f486b6f92030759'),
      ('cancelar_clase',                 '5e9dcca65397ff7c92d1363e5aa3e4a5'),
      ('cancelar_reserva',               '08f3a5dd91c2283a991cc53dfe8a4362'),
      ('generar_notificacion',           '111e8b5bab94cee59736c57fbffb5296'),
      ('impedir_reserva_si_bloqueado',   '887952e542d411b90ae6d9e0f435b810'),
      ('notificar_publicacion_clase',    '38f70675f0e3a6b444d07d47eb93d11a'),
      ('procesar_recordatorios',         'f9d3e448bdfa891f177d0888dce2a4dc'),
      ('purgar_notificaciones_historial','4341c2cc5ce7845f32345655c5a40772'),
      ('reservar_clase',                 '843591d994ce30fac5d051afe5e44cbc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace

) comprobaciones
order by orden, comprobacion;
