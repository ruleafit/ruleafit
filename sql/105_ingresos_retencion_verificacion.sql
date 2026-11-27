-- Verificación de 105 (solo lectura).
-- 1) Permisos. Esperado: mis_ingresos solo authenticated; las otras tres ni anon ni authenticated.
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('mis_ingresos', 'cobro_retenido', 'liberar_pendientes', 'devolver_y_cerrar_incidencia') order by 1;
-- 2) La liberación ya mira las reclamaciones (true).
select prosrc like '%cobro_retenido%' as retiene from pg_proc where oid = 'public.liberar_pendientes()'::regprocedure;
-- 3) Cobros retenidos ahora mismo.
select id, estado, neto_centimos, liberado_en from public.cobros
 where estado = 'pagado' and public.cobro_retenido(id, reserva_id);
