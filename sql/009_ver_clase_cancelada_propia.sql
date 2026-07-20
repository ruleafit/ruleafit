-- ============================================================================
-- Openfit · 009_ver_clase_cancelada_propia.sql
-- Amplía la política de lectura de public.clases para que un usuario
-- autenticado pueda ver también una clase no activa (p.ej. cancelada por el
-- entrenador) si tiene una reserva propia (cualquier estado) sobre ella.
-- Necesario para que /mis-reservas pueda mostrar los datos de la clase en la
-- sección "Clases canceladas por el entrenador" (hasta ahora el join
-- clases(...) devolvía null para esas filas porque RLS bloqueaba la lectura
-- de clases con estado <> 'activa').
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de public.clases (tabla ya existente, creada fuera de los scripts
-- de sql/, ver PROGRESS.md Fase 2) con su política actual "Ver clases
-- activas" (SELECT, using (estado = 'activa'::text), confirmada en el SQL
-- Editor de Supabase) y de sql/001_reservas.sql (tabla public.reservas).
--
-- No toca las políticas de INSERT ni UPDATE de public.clases, ni ninguna
-- otra tabla.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Ampliar "Ver clases activas": misma política (mismo nombre, mismo cmd
-- SELECT), condición ampliada con OR en vez de sustituida. DROP + CREATE
-- porque no existe "ALTER POLICY ... USING" que permita cambiar la condición
-- de una política ya creada sin recrearla.
--
-- Regla final: visible si la clase está activa, O si el usuario autenticado
-- tiene alguna reserva propia (activa o cancelada, cualquier estado) sobre
-- esa clase.
-- ----------------------------------------------------------------------------
drop policy if exists "Ver clases activas" on public.clases;

create policy "Ver clases activas"
  on public.clases
  for select
  using (
    estado = 'activa'
    or exists (
      select 1
      from public.reservas
      where reservas.clase_id = clases.id
        and reservas.cliente_id = auth.uid()
    )
  );
