-- 014_comprobar_clase_x.sql
-- Solo lectura. Comprueba qué clases se titulan "x" y si tienen reservas.
-- No borra ni modifica nada.

-- 1) Clases cuyo título es exactamente "x" (sin distinguir mayúsculas ni espacios sobrantes)
select id, titulo, ciudad, categoria, fecha, hora, plazas_max, plazas_ocupadas, estado, trainer_id
from public.clases
where lower(trim(titulo)) = 'x';

-- 2) Reservas asociadas a esas clases (si sale alguna fila, la clase tiene reservas)
select r.id as reserva_id, r.estado, r.clase_id, c.titulo
from public.reservas r
join public.clases c on c.id = r.clase_id
where lower(trim(c.titulo)) = 'x';
