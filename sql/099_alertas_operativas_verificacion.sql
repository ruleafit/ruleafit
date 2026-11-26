-- Verificación de 099 (solo lectura).
-- 1) Frenos quitados y pagos desactivados. Esperado: false, false, false.
select pagos_activos, parada_cobros, parada_devoluciones from public.config_pagos;

-- 2) Funciones solo para el servicio. Esperado: anon=false y authenticated=false en todas.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as servicio
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('estado_paradas', 'parar_pagos', 'reanudar_pagos', 'registrar_alerta', 'resolver_alerta_clave',
                     'resolver_alerta', 'alertas_por_avisar', 'marcar_alertas_avisadas', 'alerta_segun',
                     'revisar_salud_pagos', 'bloquear_cobros_en_parada')
 order by 1;

-- 3) Tabla sin acceso de cliente y trigger instalado. Esperado: rls=true, false, false; 1 fila.
select relrowsecurity as rls,
       has_table_privilege('anon', oid, 'select') as anon,
       has_table_privilege('authenticated', oid, 'select') as authenticated
  from pg_class where oid = 'public.alertas_operativas'::regclass;
select tgname from pg_trigger where tgname = 'trg_bloquear_cobros_en_parada';

-- 4) Alertas abiertas (tras ejecutar el cron o «select public.revisar_salud_pagos();», que escribe).
select tipo, clave, gravedad, veces, detalle from public.alertas_operativas where resuelta_en is null order by ultima_en desc;
