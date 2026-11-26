-- Verificación de 096 (solo lectura).
select count(*) as tabla_devoluciones from information_schema.tables
 where table_schema = 'public' and table_name = 'devoluciones';           -- 1
select proname from pg_proc where proname in ('reclamar_devolucion','completar_devolucion'); -- 2 filas
select * from public.devoluciones;                                         -- vacía hasta la primera devolución
select estado, count(*) from public.cobros group by 1;                     -- cobros por estado
