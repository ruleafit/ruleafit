-- 077_clases_precio_dos_decimales.sql
-- Cierre de la auditoría financiera (paso 2): clases.precio es numeric sin
-- límite de decimales (016_tabla_clases.sql), y crear_cobro (072) calcula el
-- importe con round(precio * 100). Un precio de 10,005 € se cobraría como
-- 10,01 € sin que nadie lo hubiera escrito así. El formulario de publicar ya
-- valida 2 decimales en el navegador, pero la tabla admite INSERT directo
-- (política "Crear clases (solo entrenadores)"), así que se blinda también aquí.
--
-- Qué hace: añade a public.clases la restricción
--     precio >= 0  y  precio = round(precio, 2)
-- (nunca negativo y como máximo 2 decimales). Si precio fuera NULL, el CHECK
-- no lo rechaza (la columna ya es NOT NULL por su cuenta).
--
-- Cómo aplicarlo: manualmente, en el SQL Editor de Supabase, por pasos.
-- NO se aplica solo: este archivo no lo ejecuta ninguna herramienta.
--
-- PASO 1 (ANTES de aplicar): busca filas existentes que ya incumplan la regla.
-- Debe devolver 0 filas. Si devuelve alguna, NO sigas: hay que corregir esos
-- precios a mano primero (decide con quien corresponda cuál es el precio
-- correcto; no se redondean automáticamente porque cambiaría lo que cobra el
-- entrenador).
--
--   select id, titulo, trainer_id, precio, estado
--   from public.clases
--   where precio < 0 or precio <> round(precio, 2)
--   order by created_at;
--
-- PASO 2: crear la restricción como NOT VALID. A partir de este momento se
-- comprueba en todo INSERT/UPDATE nuevo, sin escanear la tabla entera ni
-- bloquear lecturas.

alter table public.clases
  drop constraint if exists clases_precio_dos_decimales;

alter table public.clases
  add constraint clases_precio_dos_decimales
  check (precio >= 0 and precio = round(precio, 2))
  not valid;

-- PASO 3: validar las filas ya existentes. Si el PASO 1 salió vacío, termina
-- sin errores. (Si falla, la restricción sigue activa para filas nuevas; corrige
-- las filas que indique el error y vuelve a ejecutar solo este PASO 3.)

alter table public.clases
  validate constraint clases_precio_dos_decimales;

-- PASO 4: verificación.
--   a) La restricción existe y está validada (convalidated = true):
--        select conname, convalidated
--        from pg_constraint
--        where conrelid = 'public.clases'::regclass
--          and conname = 'clases_precio_dos_decimales';
--   b) Prueba en una transacción que se deshace (debe dar error 23514):
--        begin;
--        insert into public.clases (trainer_id, titulo, categoria, ciudad,
--                                   fecha, hora, precio)
--        select id, 'prueba', 'Otros', 'Sevilla', current_date + 1, '10:00', 10.005
--        from auth.users limit 1;
--        rollback;
--
-- PARA REVERTIR (si hiciera falta):
--   alter table public.clases drop constraint clases_precio_dos_decimales;
