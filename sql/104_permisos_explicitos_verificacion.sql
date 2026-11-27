-- Verificación de 104 (solo lectura). Esperado: 7 filas con servicio = true y anon = false.
select relname, has_table_privilege('service_role', oid, 'select,insert,update,delete') as servicio,
       has_table_privilege('anon', oid, 'select') as anon
  from pg_class where relnamespace = 'public'::regnamespace
   and relname in ('archivo_fiscal', 'devoluciones', 'incidencias_pago', 'incidencias_pago_eventos', 'alertas_operativas', 'reprogramaciones', 'reprogramacion_respuestas') order by 1;
