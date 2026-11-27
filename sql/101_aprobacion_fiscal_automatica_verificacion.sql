-- Verificación de 101 (solo lectura). Esperado: aprueba_sola = true, anon = false, authenticated = false, servicio = true.
select prosrc like '%evaluación automática%' as aprueba_sola,
       has_function_privilege('anon', oid, 'execute') as anon,
       has_function_privilege('authenticated', oid, 'execute') as authenticated,
       has_function_privilege('service_role', oid, 'execute') as servicio
  from pg_proc where pronamespace = 'public'::regnamespace and proname = 'guardar_perfil_fiscal';
select estado, count(*) from public.perfiles_fiscales group by 1;
