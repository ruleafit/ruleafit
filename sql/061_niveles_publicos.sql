-- ============================================================================
-- Ruleafit · 061_niveles_publicos.sql
-- Hace público el saldo de Rulos (y por tanto el nivel calculado en el
-- frontend, ver lib/niveles.js) para que se pueda mostrar el nivel de
-- CUALQUIER usuario en el directorio de ruleros y en su perfil público.
-- Pedido por el usuario el 12 sept 2026: ver el nivel de otros motiva a
-- subir el propio.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "ruleafit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Nueva política RLS en rulos_saldos: cualquier usuario autenticado
--    puede leer el saldo de cualquier otro. No es información sensible
--    (solo puntos de gamificación, sin uso monetario), así que no hay
--    problema en abrirla. Se AÑADE esta política sin tocar la que ya
--    existía ("cada usuario ve su propio saldo de Rulos", creada en
--    sql/006 con el nombre antiguo "Open"): en RLS, varias políticas
--    permisivas se combinan con OR, así que la vieja queda simplemente
--    redundante (no hace falta borrarla) y esta nueva es la que de verdad
--    decide el acceso a partir de ahora.
-- ----------------------------------------------------------------------------
create policy "cualquier autenticado ve el saldo de cualquiera"
  on public.rulos_saldos
  for select
  to authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 2) listar_entrenadores(): añade el saldo de Rulos de cada perfil (0 si
--    todavía no tiene fila en rulos_saldos, aunque en la práctica todo
--    usuario registrado ya tiene una por la bienvenida automática). Se
--    borra primero por el mismo motivo que en sql/060 (cambian las
--    columnas de salida, CREATE OR REPLACE no lo permite).
-- ----------------------------------------------------------------------------
drop function if exists public.listar_entrenadores();

create or replace function public.listar_entrenadores()
returns table (
    id          uuid,
    username    text,
    descripcion text,
    foto_url    text,
    rulos_saldo integer
)
language sql
security definer
set search_path = public
as $$
    select p.id, p.username, p.descripcion, p.foto_url, coalesce(rs.saldo, 0) as rulos_saldo
    from public.perfiles p
    left join public.rulos_saldos rs on rs.usuario_id = p.id
    order by p.username asc;
$$;

comment on function public.listar_entrenadores() is
  'Lista todos los usuarios con perfil (id, username, descripción, foto, saldo de Rulos). El saldo se usa en el frontend para calcular y mostrar el nivel de cada uno (ver lib/niveles.js). El nombre de la función se mantiene por compatibilidad con el código existente.';

revoke all on function public.listar_entrenadores() from public;
grant execute on function public.listar_entrenadores() to authenticated;


-- ----------------------------------------------------------------------------
-- Verificación post-deploy sugerida (SQL Editor):
--   select public.listar_entrenadores();  -- debe incluir la columna rulos_saldo
--   -- con otra cuenta que no sea la tuya, comprobar que
--   -- select saldo from public.rulos_saldos where usuario_id = '<uuid de otro usuario>';
--   -- ya devuelve una fila en vez de vacío.
-- ============================================================================
