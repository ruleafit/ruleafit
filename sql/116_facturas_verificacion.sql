-- Verificación de 116 (solo lectura). Una fila: todas las columnas deben salir true.
select to_regclass('public.facturas') is not null as tabla,
       (select not facturas_validadas from public.config_pagos where id) as solo_borradores,
       has_function_privilege('service_role', 'public.generar_borradores_facturas()', 'execute') as servicio,
       has_function_privilege('authenticated', 'public.mis_facturas()', 'execute') as organizador,
       not has_table_privilege('authenticated', 'public.facturas', 'select')
         and not has_function_privilege('authenticated', 'public.emitir_factura(uuid)', 'execute')
         and not has_function_privilege('anon', 'public.mis_facturas()', 'execute') as cerrado;
