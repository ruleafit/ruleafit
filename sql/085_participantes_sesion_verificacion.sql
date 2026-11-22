-- Ruleafit · 085_participantes_sesion_verificacion.sql · SOLO LECTURA. Todas las filas ok = true.
select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (
  select 1 as orden, 'Existe perfil_privacidad con RLS' as comprobacion,
         (select relrowsecurity::text from pg_class where oid = 'public.perfil_privacidad'::regclass) as obtenido, 'true' as esperado
  union all select 1, 'anon sin permisos en perfil_privacidad',
         has_table_privilege('anon', 'public.perfil_privacidad', 'select,insert,update,delete')::text, 'false'
  union all select 1, 'authenticated sin borrado en perfil_privacidad',
         has_table_privilege('authenticated', 'public.perfil_privacidad', 'delete')::text, 'false'
  union all select 1, 'Políticas de perfil_privacidad (3, solo propias)',
         (select count(*)::text from pg_policies where schemaname='public' and tablename='perfil_privacidad' and roles::text = '{authenticated}'), '3'
  union all select 2, 'participantes_clase: SECURITY DEFINER con search_path fijo',
         (select (p.prosecdef and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text from pg_proc p where p.oid = 'public.participantes_clase(uuid)'::regprocedure), 'true'
  union all select 2, 'participantes_clase: anon NO puede ejecutarla',
         has_function_privilege('anon', 'public.participantes_clase(uuid)', 'execute')::text, 'false'
  union all select 2, 'participantes_clase: authenticated sí',
         has_function_privilege('authenticated', 'public.participantes_clase(uuid)', 'execute')::text, 'true'
  union all select 3, 'Reservas intactas (política «clientes ven sus propias reservas»)',
         (select count(*)::text from pg_policies where schemaname='public' and tablename='reservas' and policyname='clientes ven sus propias reservas'), '1'
  union all select 3, 'anon sigue sin ver filas de reservas por RLS (sin política para anon)',
         (select count(*)::text from pg_policies where schemaname='public' and tablename='reservas' and roles::text like '%anon%'), '0'
  union all
  select 4, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
    from pg_proc p join (values
      ('reservar_clase',        '843591d994ce30fac5d051afe5e44cbc'),
      ('cancelar_reserva',      '08f3a5dd91c2283a991cc53dfe8a4362'),
      ('cancelar_clase',        '5e9dcca65397ff7c92d1363e5aa3e4a5'),
      ('generar_notificacion',  '111e8b5bab94cee59736c57fbffb5296'),
      ('procesar_recordatorios','f9d3e448bdfa891f177d0888dce2a4dc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace
) c order by orden, comprobacion;
