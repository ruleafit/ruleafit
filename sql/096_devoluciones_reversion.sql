-- Reversión de 096. Solo si NO hay devoluciones reales registradas.
drop function if exists public.completar_devolucion(uuid, boolean, text, text);
drop function if exists public.reclamar_devolucion();
drop table if exists public.devoluciones;
