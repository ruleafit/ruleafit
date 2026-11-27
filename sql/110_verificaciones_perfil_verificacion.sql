-- Comprobación de 110 (solo lectura). Todas las columnas deben salir en true.
select
  (select count(*) = 2 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles'
      and column_name in ('identidad_verificada', 'titulacion_acreditada')) as columnas_perfil,
  (select count(*) = 2 from storage.buckets
    where id in ('verificaciones-identidad', 'titulaciones') and not public) as buckets_privados,
  (select count(*) = 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'verificaciones: subir a la carpeta propia' and cmd = 'INSERT') as politica_subida,
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.verificaciones_identidad'::regclass, 'public.titulaciones'::regclass,
                  'public.archivos_verificacion_por_borrar'::regclass)) as rls_activa,
  not has_table_privilege('authenticated', 'public.titulaciones', 'insert') as sin_alta_directa,
  not has_function_privilege('authenticated',
    'public.resolver_titulacion(uuid, text, text, uuid)', 'execute') as usuario_no_aprueba,
  not has_function_privilege('authenticated',
    'public.resolver_verificacion_identidad(uuid, text, text, uuid, text)', 'execute') as usuario_no_aprueba_identidad,
  has_function_privilege('service_role',
    'public.resolver_titulacion(uuid, text, text, uuid)', 'execute') as servidor_aprueba,
  (select count(*) = 1 from pg_trigger
    where tgname = 'trg_perfiles_insignias' and not tgisinternal) as insignias_protegidas;

-- Si aparece alguna política de lectura sobre estos buckets, revisarla: no debe haber ninguna.
select policyname, cmd, qual, with_check from pg_policies
 where schemaname = 'storage' and tablename = 'objects';
