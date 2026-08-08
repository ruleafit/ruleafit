-- 036_notificaciones_cola.sql
-- Cola de notificaciones push pendientes de enviar. Cada fila es una
-- notificacion para un usuario concreto. Los eventos (RPCs con SECURITY
-- DEFINER) insertan filas aqui; un cron las procesa y las marca como enviadas.
-- RLS restrictivo: ningun usuario normal puede leer ni escribir esta cola;
-- solo las RPCs (definer) y el backend (service role) la tocan.

create table if not exists public.notificaciones_cola (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  tipo         text not null,
  titulo       text not null,
  cuerpo       text not null,
  url          text not null default '/',
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'enviada', 'error')),
  intentos     integer not null default 0,
  created_at   timestamptz not null default now(),
  enviada_at   timestamptz
);

-- Indice para que el cron lea rapido las pendientes por orden de llegada.
create index if not exists notificaciones_cola_pendientes_idx
  on public.notificaciones_cola (estado, created_at)
  where estado = 'pendiente';

alter table public.notificaciones_cola enable row level security;

-- RLS: sin ninguna policy para usuarios. Nadie desde el cliente puede leer
-- ni escribir. Las RPCs SECURITY DEFINER insertan saltandose RLS por ser
-- definer; el backend lee/actualiza con la service role key (se salta RLS).
-- No se crea ninguna policy a proposito.
