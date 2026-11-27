-- Comprobación de 111 (solo lectura). Una sola consulta: todo debe salir en true.
select
  has_function_privilege('anon', 'public.titulaciones_visibles(uuid)', 'execute') as listado_publico,
  (select count(*) = 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'denuncias' and column_name = 'detalle') as columna_detalle,
  (select pg_get_constraintdef(oid) like '%titulacion%' from pg_constraint
    where conrelid = 'public.denuncias'::regclass and conname = 'denuncias_tipo_check') as admite_titulacion,
  (select pg_get_constraintdef(oid) like '%titulacion_falsa%' from pg_constraint
    where conrelid = 'public.denuncias'::regclass and conname = 'denuncias_motivo_check') as motivos_nuevos,
  (select count(*) = 1 from pg_trigger
    where tgname = 'trg_preparar_denuncia_titulacion' and not tgisinternal) as trigger_activo,
  not has_function_privilege('authenticated',
    'public.preparar_denuncia_titulacion()', 'execute') as trigger_no_invocable,
  -- La única política de lectura de denuncias es la de quien las envía.
  (select count(*) = 1 and bool_and(qual like '%denunciante_id%') from pg_policies
    where schemaname = 'public' and tablename = 'denuncias' and cmd in ('SELECT', 'ALL')) as denunciado_no_las_ve;
