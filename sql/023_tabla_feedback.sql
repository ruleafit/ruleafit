-- ============================================================================
-- Openfit · 023_tabla_feedback.sql
-- Tabla public.feedback: mensajes libres (problemas, sugerencias, etc.) que
-- cualquier usuario con sesión puede enviar. Se revisan a mano desde el panel
-- de Supabase (Table Editor), que usa la service role y se salta RLS, así
-- que no hace falta ninguna política de SELECT para usuarios normales.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP CONSTRAINT/POLICY IF EXISTS
-- antes de cada ADD CONSTRAINT / CREATE POLICY, para poder reejecutar el
-- archivo sin error.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Tabla public.feedback
-- ----------------------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mensaje    text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback
  drop constraint if exists feedback_mensaje_longitud;

alter table public.feedback
  add constraint feedback_mensaje_longitud
  check (char_length(mensaje) <= 1000 and char_length(trim(mensaje)) > 0);

comment on table public.feedback is
  'Mensajes de feedback (problemas, sugerencias, etc.) enviados por usuarios con sesión iniciada. Se revisan manualmente desde el panel de Supabase (Table Editor), que usa la service role y no está sujeto a RLS; los usuarios normales no tienen política de SELECT porque no necesitan leer el feedback, solo enviarlo.';
comment on column public.feedback.id is
  'Identificador único del mensaje de feedback.';
comment on column public.feedback.user_id is
  'Usuario autenticado que envió el mensaje. Referencia a auth.users(id), on delete cascade.';
comment on column public.feedback.mensaje is
  'Contenido del mensaje, hasta 1000 caracteres y no vacío (ver feedback_mensaje_longitud).';
comment on column public.feedback.created_at is
  'Fecha y hora de creación del mensaje.';


-- ----------------------------------------------------------------------------
-- 2) RLS: solo INSERT propio para usuarios autenticados. Sin política de
--    SELECT/UPDATE/DELETE para "authenticated": el feedback se lee y
--    gestiona desde el panel de Supabase con la service role.
-- ----------------------------------------------------------------------------
alter table public.feedback enable row level security;

drop policy if exists "cada usuario envia su propio feedback" on public.feedback;

create policy "cada usuario envia su propio feedback"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);
