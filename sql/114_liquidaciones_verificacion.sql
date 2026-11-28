-- Verificación de 114 (solo lectura). Una fila: todas las columnas deben salir true.
select to_regprocedure('public.cerrar_liquidacion()') is not null as funciones,
       has_function_privilege('service_role', 'public.cerrar_liquidacion()', 'execute') as servicio,
       not has_function_privilege('authenticated', 'public.cerrar_liquidacion()', 'execute')
         and not has_function_privilege('anon', 'public.datos_transferencia(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.datos_transferencia(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.panel_liquidaciones()', 'execute') as cerrado_a_usuarios,
       (select not liquidar_bonos_en_plazo from public.config_pagos where id) as bonos_en_plazo_no_se_pagan,
       (public.panel_liquidaciones() ? 'prevision') as panel;
