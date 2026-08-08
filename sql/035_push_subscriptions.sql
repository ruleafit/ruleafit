-- 035_push_subscriptions.sql
-- Suscripciones de notificaciones push por usuario (uno a muchos: un usuario
-- puede tener varios dispositivos/navegadores). Los datos son privados: cada
-- usuario solo ve/gestiona los suyos. El backend de envio los lee con la
-- service role key (se salta RLS), por eso aqui RLS es restrictivo.

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  unique (usuario_id, endpoint)
);

-- Indice para buscar rapido todas las suscripciones de un usuario.
create index if not exists push_subscriptions_usuario_idx
  on public.push_subscriptions (usuario_id);

alter table public.push_subscriptions enable row level security;

-- Un usuario solo puede LEER sus propias suscripciones (datos privados, no publico).
drop policy if exists "usuario lee sus suscripciones" on public.push_subscriptions;
create policy "usuario lee sus suscripciones"
  on public.push_subscriptions
  for select
  to authenticated
  using ( auth.uid() = usuario_id );

-- Un usuario solo puede CREAR suscripciones a su propio nombre.
drop policy if exists "usuario crea su suscripcion" on public.push_subscriptions;
create policy "usuario crea su suscripcion"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ( auth.uid() = usuario_id );

-- Un usuario solo puede BORRAR sus propias suscripciones.
drop policy if exists "usuario borra su suscripcion" on public.push_subscriptions;
create policy "usuario borra su suscripcion"
  on public.push_subscriptions
  for delete
  to authenticated
  using ( auth.uid() = usuario_id );

-- Sin politica de UPDATE: una suscripcion no se edita, se crea o se borra.
