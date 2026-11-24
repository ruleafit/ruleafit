-- ============================================================================
-- Ruleafit · 092_avisos_plaza_verificacion.sql  (solo lectura: se ejecuta DESPUÉS de aplicar 092_avisos_plaza.sql)
-- ============================================================================
-- 1) RLS activado y sin privilegios para anon/authenticated (salvo SELECT propio en alertas_plaza). Esperado:
--    alertas_plaza: rls=true, authenticated=SELECT ; episodios_plaza y avisos_plaza_enviados: rls=true, sin privilegios.
select c.relname, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon_cualquiera,
       has_table_privilege('authenticated', c.oid, 'insert,update,delete') as auth_escribe,
       has_table_privilege('authenticated', c.oid, 'select') as auth_lee
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('alertas_plaza', 'episodios_plaza', 'avisos_plaza_enviados');

-- 2) Permisos de funciones. Esperado: solo activar/desactivar/mis_avisos para authenticated; el resto, nadie.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       p.prosecdef as security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('activar_aviso_plaza', 'desactivar_aviso_plaza', 'mis_avisos_plaza', 'procesar_episodio_plaza',
                     'procesar_episodios_plaza_pendientes', 'limpiar_avisos_plaza', 'empujar_cola_notificaciones',
                     'detectar_plaza_liberada', 'desactivar_aviso_al_reservar', 'sesion_ya_empezo')
 order by 1;

-- 3) Triggers instalados (esperado: 1 diferido en clases y 1 en reservas).
select tgrelid::regclass as tabla, tgname, tgdeferrable, tginitdeferred
  from pg_trigger where tgname in ('trg_detectar_plaza_liberada', 'trg_desactivar_aviso_al_reservar');

-- 4) generar_notificacion conoce el tipo nuevo (esperado: true).
select pg_get_functiondef('public.generar_notificacion(uuid,text,text,text,text)'::regprocedure) like '%plaza_libre%' as conoce_plaza_libre;
