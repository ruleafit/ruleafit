-- Verificación de 103 (solo lectura).
-- 1) Funciones. Esperado: las *_base sin acceso; crear_cobro y abrir_incidencia_cobro solo authenticated.
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('crear_cobro', 'crear_cobro_base', 'confirmar_cobro_pagado', 'confirmar_cobro_pagado_base',
                     'abrir_incidencia_cobro', 'mis_reservas_reclamables', 'caducar_cobros_abandonados') order by 1;
-- 2) Trigger de publicación (1 fila) y cron de caducidad (1 fila).
select tgname from pg_trigger where tgname = 'trg_exigir_perfil_para_sesion_de_pago';
select jobname, schedule from cron.job where jobname in ('caducar-cobros-abandonados', 'procesar-devoluciones') order by 1;
-- 3) Sin cobros 'creado' de más de 35 minutos (0 tras el primer pase del cron).
select count(*) as sin_caducar from public.cobros where estado = 'creado' and created_at < now() - interval '35 minutes';
