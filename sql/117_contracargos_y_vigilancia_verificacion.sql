-- Verificación de sql/117 (solo lectura). Las cuatro columnas deben salir en «true».
select
  to_regclass('public.contracargos') is not null as tabla,
  to_regprocedure('public.resolver_contracargo(uuid, text)') is not null as funciones,
  pg_get_functiondef('public.cobro_retenido(uuid, uuid)'::regprocedure) like '%contracargos%'
    and pg_get_functiondef('public.liquidacion_cobros(date)'::regprocedure) like '%contracargos%'
    and pg_get_functiondef('public.reclamar_devolucion_cobro()'::regprocedure) like '%contracargos%' as retenciones,
  not has_table_privilege('authenticated', 'public.contracargos', 'select')
    and not has_function_privilege('authenticated', 'public.resolver_contracargo(uuid, text)', 'execute') as privado;
