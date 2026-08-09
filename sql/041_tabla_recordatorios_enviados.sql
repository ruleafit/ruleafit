-- 041_tabla_recordatorios_enviados.sql
-- Control para deduplicar recordatorios programados. Antes de encolar un
-- recordatorio (24h/7h/~2h, cliente o entrenador) se inserta aqui una fila.
-- La restriccion unica garantiza que cada uno se encola UNA sola vez aunque
-- el cron de escaneo pase muchas veces mientras la sesion esta en la ventana.

create table if not exists public.recordatorios_enviados (
  id         uuid primary key default gen_random_uuid(),
  clase_id   uuid not null references public.clases(id) on delete cascade,
  usuario_id uuid not null references auth.users(id)    on delete cascade,
  tipo       text not null,
  created_at timestamptz not null default now(),
  unique (clase_id, usuario_id, tipo)
);

alter table public.recordatorios_enviados enable row level security;
-- Sin policies: solo la funcion SECURITY DEFINER procesar_recordatorios escribe aqui.
