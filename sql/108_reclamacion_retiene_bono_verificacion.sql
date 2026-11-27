-- Verificación de 108 (solo lectura). Esperado: incluye_bono = true y expuesta = false.
select position('r.bono_cliente_id = c.bono_cliente_id' in pg_get_functiondef('public.cobro_retenido(uuid, uuid)'::regprocedure)) > 0 as incluye_bono,
       has_function_privilege('authenticated', 'public.cobro_retenido(uuid, uuid)', 'execute') as expuesta;
