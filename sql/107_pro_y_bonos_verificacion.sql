-- Verificación de 107 (solo lectura). Esperado: una sola fila con todo en true y precio 4000, comisión 0, uso 25.
select
  (select count(*) from pg_tables where schemaname = 'public'
     and tablename in ('suscripciones_pro', 'pagos_pro', 'bonos_cancelaciones', 'bonos_retenciones')) = 4 as tablas,
  (select count(*) from pg_trigger where tgname in ('trg_validar_bono', 'trg_impedir_bono_sin_pago',
     'trg_devolver_bonos_por_bloqueo', 'trg_contar_cancelacion_con_bono') and not tgisinternal) = 4 as triggers,
  not exists (select 1 from pg_trigger where tgname = 'trg_impedir_bono_con_pagos') as sin_bloqueo_106,
  not has_function_privilege('authenticated', 'public.confirmar_pago_pro(text, integer, boolean, text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.devolver_bono(uuid, text)', 'execute')
    and not has_table_privilege('authenticated', 'public.suscripciones_pro', 'select') as permisos,
  has_function_privilege('authenticated', 'public.crear_cobro_bono(uuid, text, text)', 'execute') as compra,
  pro_precio_centimos, comision_bonos_bps, bono_desistimiento_uso_max_pct
from public.config_pagos where id;
