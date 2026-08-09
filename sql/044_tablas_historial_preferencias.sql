-- 044_tablas_historial_preferencias.sql
-- Sub-bloque 7: centro de notificaciones + preferencias.
-- Dos tablas nuevas, ambas con RLS calcado del patron de push_subscriptions
-- (sql/035): el usuario solo ve/gestiona lo suyo, auth.uid() = usuario_id.

-- HISTORIAL: registro de TODAS las notificaciones generadas para un usuario,
-- se guarden o no como push. Alimenta la campanita. Incluye flag leido.
create table if not exists public.notificaciones_historial (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  cuerpo     text not null,
  url        text not null default '/',
  leido      boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificaciones_historial_usuario_idx
  on public.notificaciones_historial (usuario_id, created_at desc);

alter table public.notificaciones_historial enable row level security;

-- El usuario lee su propio historial.
drop policy if exists "usuario lee su historial" on public.notificaciones_historial;
create policy "usuario lee su historial"
  on public.notificaciones_historial
  for select to authenticated
  using ( auth.uid() = usuario_id );

-- El usuario actualiza su propio historial (marcar leido).
drop policy if exists "usuario marca leido su historial" on public.notificaciones_historial;
create policy "usuario marca leido su historial"
  on public.notificaciones_historial
  for update to authenticated
  using ( auth.uid() = usuario_id )
  with check ( auth.uid() = usuario_id );
-- Sin policy de insert: solo escribe la funcion SECURITY DEFINER generar_notificacion.

-- PREFERENCIAS: opt-out por categoria. Ausencia de fila = activado.
-- Solo se crean filas cuando el usuario DESACTIVA algo.
create table if not exists public.preferencias_notificaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria  text not null,
  activo     boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (usuario_id, categoria)
);

alter table public.preferencias_notificaciones enable row level security;

drop policy if exists "usuario lee sus preferencias" on public.preferencias_notificaciones;
create policy "usuario lee sus preferencias"
  on public.preferencias_notificaciones
  for select to authenticated
  using ( auth.uid() = usuario_id );

drop policy if exists "usuario crea sus preferencias" on public.preferencias_notificaciones;
create policy "usuario crea sus preferencias"
  on public.preferencias_notificaciones
  for insert to authenticated
  with check ( auth.uid() = usuario_id );

drop policy if exists "usuario edita sus preferencias" on public.preferencias_notificaciones;
create policy "usuario edita sus preferencias"
  on public.preferencias_notificaciones
  for update to authenticated
  using ( auth.uid() = usuario_id )
  with check ( auth.uid() = usuario_id );
