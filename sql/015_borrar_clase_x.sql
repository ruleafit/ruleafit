-- 015_borrar_clase_x.sql
-- Borra la clase de prueba titulada "x" y su única reserva activa.
-- Acotado por IDs exactos comprobados en 014. NO usa el título como filtro de borrado.
-- Se ejecuta manualmente en el editor SQL de Supabase.

begin;

-- 1) Borrar primero la reserva (apunta a la clase por clave foránea)
delete from public.reservas
where id = '2b82fcba-0a12-4ffd-b457-a08826cd59ea'
  and clase_id = 'bdbe8779-af75-447c-b241-d83e9a1525ad';

-- 2) Borrar después la clase
delete from public.clases
where id = 'bdbe8779-af75-447c-b241-d83e9a1525ad';

commit;
