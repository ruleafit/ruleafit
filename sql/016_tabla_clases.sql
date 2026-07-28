-- 016_tabla_clases.sql
-- Definicion versionada de la tabla public.clases.
-- La tabla se creo originalmente a mano en Supabase; este archivo la documenta
-- de forma reproducible. Es SEGURO ejecutarlo sobre la base actual: usa
-- IF NOT EXISTS y DROP POLICY IF EXISTS, por lo que no rompe nada si ya existe.
-- Refleja el estado real de la tabla a 27 julio 2026.

-- 1) Tabla
create table if not exists public.clases (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  categoria text not null,
  tipo_actividad text not null,
  ciudad text not null,
  direccion text,
  lat double precision,
  lng double precision,
  punto_encuentro text,
  fecha date not null,
  hora time without time zone not null,
  duracion integer,
  nivel text,
  precio numeric not null default 0,
  plazas_max integer not null default 10,
  plazas_ocupadas integer not null default 0,
  material text,
  observaciones text,
  estado text not null default 'activa',
  created_at timestamp with time zone not null default now(),
  plazas_min integer not null default 0,
  constraint clases_plazas_min_rango check (plazas_min >= 0 and plazas_min <= plazas_max)
);

-- 2) Row Level Security
alter table public.clases enable row level security;

-- 3) Politicas RLS

drop policy if exists "Crear clases (solo entrenadores)" on public.clases;
create policy "Crear clases (solo entrenadores)"
  on public.clases
  for insert
  to authenticated
  with check (
    auth.uid() = trainer_id
    and ((auth.jwt() -> 'user_metadata') ->> 'rol') = 'entrenador'
  );

drop policy if exists "Editar mis clases" on public.clases;
create policy "Editar mis clases"
  on public.clases
  for update
  to authenticated
  using (auth.uid() = trainer_id)
  with check (auth.uid() = trainer_id);

drop policy if exists "Ver clases activas" on public.clases;
create policy "Ver clases activas"
  on public.clases
  for select
  to public
  using (estado = 'activa' or usuario_tiene_reserva_en_clase(id));
