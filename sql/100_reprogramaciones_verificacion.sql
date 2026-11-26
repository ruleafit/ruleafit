-- Verificación de 100 (solo lectura).
-- 1) Tablas con RLS y sin acceso de cliente. Esperado: rls=true, anon=false, authenticated=false.
select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon,
       has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') as authenticated
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('reprogramaciones', 'reprogramacion_respuestas');

-- 2) Funciones. Esperado: anon=false en todas; authenticated=true salvo reprogramacion_tras_pago.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('reprogramar_sesion', 'mis_reprogramaciones_pendientes', 'responder_reprogramacion',
                     'reprogramacion_tras_pago', 'cancelar_reserva')
 order by 1;

-- 3) cancelar_reserva ya tiene en cuenta los cambios pendientes (true) y el trigger existe (1 fila).
select pg_get_functiondef('public.cancelar_reserva(uuid)'::regprocedure) like '%reprogramacion_respuestas%' as conoce_cambios;
select tgname from pg_trigger where tgname = 'trg_reprogramacion_tras_pago';
