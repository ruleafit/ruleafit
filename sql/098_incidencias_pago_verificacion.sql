-- Verificación de 098 (solo lectura).
-- 1) RLS activo; authenticated solo lee; anon nada. Esperado: rls=true, anon=false, auth_escribe=false.
select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon,
       has_table_privilege('authenticated', c.oid, 'insert,update,delete') as auth_escribe
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('incidencias_pago', 'incidencias_pago_eventos');

-- 2) Funciones. Esperado: actualizar_incidencia solo servicio; las otras dos para authenticated y no anon.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('abrir_incidencia', 'actualizar_incidencia', 'mis_reservas_reclamables', 'incidencias_pago_anonimizar')
 order by 1;

-- 3) Casos por estado (vacío al aplicar).
select estado, count(*) from public.incidencias_pago group by 1;
