-- Verificación de 113 (solo lectura). Es una sola fila: todas las columnas deben salir true.
select position('bonos_admitidos' in pg_get_functiondef('public.reservar_clase(uuid)'::regprocedure)) > 0 as reserva_filtra,
       (select count(*) = 2 from pg_trigger where tgrelid = 'public.clases'::regclass
         and tgname in ('trg_validar_bonos_admitidos', 'trg_revisar_bonos_sin_sesiones')) as triggers_activos,
       has_column_privilege('authenticated', 'public.clases', 'bonos_admitidos', 'insert') as publicar,
       has_column_privilege('authenticated', 'public.clases', 'bonos_admitidos', 'select') as leer,
       has_function_privilege('authenticated', 'public.fijar_bonos_sesion(uuid, text, uuid[])', 'execute') as editar,
       has_function_privilege('authenticated', 'public.devolver_bono_sin_sesiones(uuid)', 'execute') as devolver,
       not has_function_privilege('anon', 'public.fijar_bonos_sesion(uuid, text, uuid[])', 'execute')
         and not has_function_privilege('anon', 'public.devolver_bono_sin_sesiones(uuid)', 'execute') as anonimo_bloqueado,
       not has_function_privilege('authenticated', 'public.publicar_serie_088(jsonb, jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.bono_vivo(uuid)', 'execute') as internas_cerradas;
