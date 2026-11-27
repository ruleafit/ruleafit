-- Verificación de 106 (solo lectura). Esperado: 1 fila con activo = true y anon = false.
select tgname, tgenabled <> 'D' as activo,
       has_function_privilege('anon', 'public.impedir_bono_con_pagos()', 'execute') as anon
  from pg_trigger
 where tgrelid = 'public.bonos_clientes'::regclass and tgname = 'trg_impedir_bono_con_pagos';
