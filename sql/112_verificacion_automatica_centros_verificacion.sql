-- Comprobación de 112 (solo lectura). Una sola consulta: todo debe salir en true.
select
  (select count(*) = 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles' and column_name = 'centro_verificado') as columna_perfil,
  (select count(*) = 3 from information_schema.columns
    where table_schema = 'public' and table_name = 'verificaciones_identidad'
      and column_name in ('metodo', 'analizado_en', 'documento_hash')) as columnas_identidad,
  (select relrowsecurity from pg_class where oid = 'public.verificaciones_centro'::regclass) as rls_activa,
  not has_table_privilege('authenticated', 'public.verificaciones_centro', 'insert') as sin_alta_directa,
  not has_column_privilege('authenticated', 'public.verificaciones_centro', 'ruta', 'select') as ruta_oculta,
  not has_column_privilege('authenticated', 'public.verificaciones_identidad', 'documento_hash', 'select') as huella_oculta,
  not has_function_privilege('authenticated',
    'public.resolver_verificacion_centro(uuid, text, text, uuid)', 'execute') as usuario_no_aprueba,
  has_function_privilege('service_role',
    'public.resolver_verificacion_centro(uuid, text, text, uuid)', 'execute') as servidor_aprueba,
  has_function_privilege('anon', 'public.centro_publico(uuid)', 'execute') as nombre_publico,
  (select prosrc like '%centro_verificado%' from pg_proc
    where oid = 'public.proteger_insignias_perfil()'::regprocedure) as insignia_protegida,
  (select count(*) = 2 from pg_trigger
    where tgname in ('trg_verificaciones_centro_archivos', 'trg_verificaciones_centro_insignia')
      and not tgisinternal) as triggers_activos;
