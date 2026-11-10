-- 075_cerrar_update_directo_clases.sql
-- Auditoría 9-nov-2026, hallazgo 8: un entrenador podía hacer UPDATE directo
-- (API REST de Supabase) de cualquier columna de sus propias clases
-- (plazas_ocupadas, estado, precio, fecha...), saltándose editar_clase y
-- cancelar_clase. La web no hace ningún UPDATE directo sobre clases: toda
-- escritura pasa por funciones (editar_clase, cancelar_clase, reservar_clase...).
--
-- PASO 1 (ANTES de aplicar): ejecuta esta consulta. Toda fila debe tener
-- prosecdef = true. Si alguna sale en false, NO apliques el paso 2 y avísame.
--
--   select proname, prosecdef
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and prosrc ilike '%update public.clases%'
--   order by prosecdef, proname;
--
-- PASO 2: aplicar.

revoke update on table public.clases from authenticated, anon, public;

-- La política "Editar mis clases" se deja como está: sin el permiso UPDATE
-- no tiene efecto, y así no se pierde si hubiera que volver atrás.

-- PASO 3: verificación (ambas consultas deben devolver 0 filas).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'clases'
  and privilege_type = 'UPDATE' and grantee in ('authenticated', 'anon');

select grantee, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'clases'
  and privilege_type = 'UPDATE' and grantee in ('authenticated', 'anon');
