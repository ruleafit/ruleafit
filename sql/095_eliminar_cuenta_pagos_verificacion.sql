-- Solo lectura. Esperado: fk_restantes = 0, archivo_fiscal = true, rls = true,
-- anon_ejecuta = false, authenticated_ejecuta = true.
select
  (select count(*) from pg_constraint c
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and ((c.conrelid in ('public.bolsas'::regclass,'public.movimientos_bolsa'::regclass,'public.liquidaciones_lineas'::regclass) and a.attname = 'entrenador_id')
        or (c.conrelid = 'public.cobros'::regclass and a.attname in ('cliente_id','entrenador_id')))) as fk_restantes,
  to_regclass('public.archivo_fiscal') is not null as archivo_fiscal,
  (select relrowsecurity from pg_class where oid = 'public.archivo_fiscal'::regclass) as rls,
  has_function_privilege('anon', 'public.eliminar_mi_cuenta()', 'execute') as anon_ejecuta,
  has_function_privilege('authenticated', 'public.eliminar_mi_cuenta()', 'execute') as authenticated_ejecuta,
  pg_get_functiondef('public.eliminar_mi_cuenta()'::regprocedure) like '%archivo_fiscal%' as funcion_nueva;
