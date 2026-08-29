-- ============================================================================
-- Ruleafit · 005_username_disponible.sql
-- Comprobación de disponibilidad de nombre de usuario ANTES de registrarse
-- (sin sesión iniciada todavía).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/004_perfiles.sql (tabla public.perfiles, con el check de
-- formato perfiles_username_formato y el índice único case-insensitive
-- perfiles_username_unique_ci, ya creados y ejecutados).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función RPC username_disponible(p_username text)
--    Devuelve un único booleano: true si el formato es válido Y no existe ya
--    ningún perfil con ese nombre (comparación insensible a
--    mayúsculas/minúsculas, igual que el índice único de public.perfiles).
--    No selecciona ni devuelve ninguna columna de perfiles ni de auth.users:
--    el resultado de la consulta se usa solo dentro de un "exists", nunca se
--    expone.
--    SECURITY DEFINER porque debe poder consultar public.perfiles aunque
--    quien llama no tenga sesión (rol "anon", sin fila propia en perfiles ni
--    permiso de SELECT vía la política RLS existente, que exige
--    "to authenticated").
-- ----------------------------------------------------------------------------
create or replace function public.username_disponible(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    return false;
  end if;

  return not exists (
    select 1
    from public.perfiles
    where lower(username) = lower(p_username)
  );
end;
$$;

comment on function public.username_disponible(text) is
  'Comprueba si un nombre de usuario tiene formato válido (3-20 caracteres, letras ASCII/números/guion bajo) y no está ya en uso (comparación insensible a mayúsculas/minúsculas). Solo devuelve true/false, sin exponer ningún dato de perfiles ni de auth.users. SECURITY DEFINER para poder consultarse antes de iniciar sesión.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: tanto "anon" (para comprobarlo durante el
--    registro, sin sesión) como "authenticated" (por si se reutiliza, p.ej.
--    al cambiar el nombre de usuario ya con sesión iniciada).
--    Igual que las funciones anteriores: se revoca el EXECUTE a PUBLIC que
--    Postgres concede por defecto al crear la función, y se concede solo a
--    los roles que lo necesitan.
-- ----------------------------------------------------------------------------
revoke all on function public.username_disponible(text) from public;
grant execute on function public.username_disponible(text) to anon;
grant execute on function public.username_disponible(text) to authenticated;
