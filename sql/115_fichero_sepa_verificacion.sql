-- Verificación de 115 (solo lectura). Una fila: todas las columnas deben salir true.
select to_regclass('public.ficheros_sepa') is not null as tabla,
       has_function_privilege('service_role', 'public.preparar_fichero_sepa()', 'execute') as servicio,
       not has_function_privilege('authenticated', 'public.datos_fichero_sepa(uuid)', 'execute')
         and not has_function_privilege('anon', 'public.datos_fichero_sepa(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.cerrar_fichero_sepa(uuid, text)', 'execute') as cerrado_a_usuarios,
       not has_table_privilege('authenticated', 'public.ficheros_sepa', 'select') as tabla_privada,
       (public.panel_ficheros_sepa() ? 'ficheros') as panel;
