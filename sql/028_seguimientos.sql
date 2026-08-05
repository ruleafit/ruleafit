-- 028_seguimientos.sql
-- "Seguir entrenadores": quién sigue a quién.
-- Nivel de rigor A: la RLS garantiza lo verificable con auth.uid()
-- (solo creas seguimientos a tu nombre, sin duplicados, sin seguirte a ti mismo).
-- El filtro "solo clientes siguen / solo a entrenadores se sigue" se hace en el
-- frontend, igual que en valoraciones y reservas (el rol solo vive en auth.users).

create table if not exists public.seguimientos (
    id            uuid primary key default gen_random_uuid(),
    seguidor_id   uuid not null references auth.users(id) on delete cascade,
    entrenador_id uuid not null references auth.users(id) on delete cascade,
    created_at    timestamptz not null default now(),
    unique (seguidor_id, entrenador_id),
    check (seguidor_id <> entrenador_id)
);

-- Índice para listar rápido "a quién sigo" y "quién me sigue"
create index if not exists seguimientos_seguidor_idx on public.seguimientos (seguidor_id, created_at desc);
create index if not exists seguimientos_entrenador_idx on public.seguimientos (entrenador_id, created_at desc);

alter table public.seguimientos enable row level security;

-- Lectura pública (para poder mostrar nº de seguidores y estado del botón)
drop policy if exists "seguimientos visibles publicamente" on public.seguimientos;
create policy "seguimientos visibles publicamente"
    on public.seguimientos
    for select
    to public
    using ( true );

-- Un usuario solo puede crear un seguimiento a su propio nombre
drop policy if exists "usuario crea su propio seguimiento" on public.seguimientos;
create policy "usuario crea su propio seguimiento"
    on public.seguimientos
    for insert
    to authenticated
    with check ( auth.uid() = seguidor_id );

-- Un usuario solo puede borrar (dejar de seguir) sus propios seguimientos
drop policy if exists "usuario borra su propio seguimiento" on public.seguimientos;
create policy "usuario borra su propio seguimiento"
    on public.seguimientos
    for delete
    to authenticated
    using ( auth.uid() = seguidor_id );

-- Sin política de UPDATE: un seguimiento no se edita, se crea o se borra.
