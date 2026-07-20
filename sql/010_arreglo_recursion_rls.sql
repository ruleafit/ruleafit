-- ============================================================================
-- Openfit · 010_arreglo_recursion_rls.sql
-- Corrige "infinite recursion detected in policy for relation clases",
-- causado por sql/009_ver_clase_cancelada_propia.sql: la política "Ver
-- clases activas" de public.clases consultaba directamente public.reservas
-- (subconsulta EXISTS), y la política "entrenadores ven reservas de sus
-- clases" de public.reservas (sql/001_reservas.sql) consulta a su vez
-- public.clases para comprobar trainer_id = auth.uid() — cada evaluación de
-- una disparaba la evaluación de la otra sin parar.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit"). Sustituye por completo el cambio de
-- sql/009_ver_clase_cancelada_propia.sql (ese archivo queda obsoleto, no hay
-- que ejecutarlo si no se ejecutó ya; si ya se ejecutó, este script corrige
-- la política que dejó).
--
-- Depende de public.clases (con su política "Ver clases activas") y de
-- sql/001_reservas.sql (tabla public.reservas).
--
-- No toca la política "entrenadores ven reservas de sus clases" de
-- public.reservas, ni ninguna otra política de ninguna tabla.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función auxiliar public.usuario_tiene_reserva_en_clase(p_clase_id uuid)
--    SECURITY DEFINER: se ejecuta con los privilegios de quien creó la
--    función (el propietario, con acceso directo a la tabla), no con los del
--    usuario que consulta clases. Al leer public.reservas desde dentro de
--    esta función, Postgres NO vuelve a evaluar las políticas RLS de
--    reservas para esa lectura interna (ese es justo el mecanismo que rompe
--    el bucle: la cadena clases -> reservas -> clases se corta porque este
--    tramo deja de pasar por RLS).
--    Devuelve solo un booleano, sin exponer ninguna columna ni fila de
--    reservas: no hay manera de que un usuario recupere datos ajenos a
--    través de esta función, solo un sí/no sobre su propia relación con una
--    clase.
-- ----------------------------------------------------------------------------
create or replace function public.usuario_tiene_reserva_en_clase(p_clase_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.reservas
    where clase_id = p_clase_id
      and cliente_id = auth.uid()
  );
end;
$$;

comment on function public.usuario_tiene_reserva_en_clase(uuid) is
  'Indica (true/false) si el usuario autenticado tiene alguna reserva propia (cualquier estado) sobre la clase indicada. SECURITY DEFINER para poder leer public.reservas sin volver a disparar sus políticas RLS al ser llamada desde la política de SELECT de public.clases (evita la recursión clases -> reservas -> clases). No devuelve ninguna fila ni columna de reservas, solo un booleano.';

-- Se revoca el EXECUTE a PUBLIC que Postgres concede por defecto y se
-- concede explícitamente a anon y authenticated: la política de
-- public.clases que usa esta función se evalúa también para usuarios sin
-- sesión (navegación de /clases sin login), así que la función debe poder
-- ejecutarse en ambos casos. Para un usuario anónimo, auth.uid() es null y
-- la función siempre devuelve false (cliente_id en reservas es NOT NULL, no
-- puede coincidir con null), así que no cambia nada para ellos.
revoke all on function public.usuario_tiene_reserva_en_clase(uuid) from public;
grant execute on function public.usuario_tiene_reserva_en_clase(uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2) Reemplaza "Ver clases activas": misma política (mismo nombre, mismo cmd
--    SELECT), pero usando la función en vez de la subconsulta EXISTS directa
--    sobre reservas (esa subconsulta directa era la causa de la recursión).
--    Misma regla final que sql/009: visible si la clase está activa, o si el
--    usuario autenticado tiene alguna reserva propia sobre ella.
-- ----------------------------------------------------------------------------
drop policy if exists "Ver clases activas" on public.clases;

create policy "Ver clases activas"
  on public.clases
  for select
  using (
    estado = 'activa'
    or public.usuario_tiene_reserva_en_clase(clases.id)
  );
