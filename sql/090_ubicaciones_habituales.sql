-- ============================================================================
-- Ruleafit · 090_ubicaciones_habituales.sql
-- N09 · Ubicaciones habituales del organizador (privadas).
--
-- Una ubicación habitual es una AYUDA para rellenar /publicar: nombre privado + coordenadas exactas,
-- ciudad/municipio, provincia y dirección postal. NO se confunde con «Zona» ni con «Punto de
-- encuentro» (que siguen siendo campos de cada sesión y no se rellenan desde aquí).
--
-- INDEPENDENCIA DE LAS SESIONES: la tabla NO tiene ninguna relación con `clases` (ni FK ni triggers):
-- cada sesión guarda su propia copia de la ciudad, provincia y coordenadas en el momento de publicarse,
-- así que renombrar, editar o borrar una ubicación habitual nunca cambia sesiones ya publicadas ni
-- series C07.
--
-- SEGURIDAD: RLS con el patrón de las demás tablas privadas (favoritos, preferencias): cada usuario solo
-- ve, crea, modifica y borra SUS ubicaciones (usuario_id = auth.uid()); sin acceso para anon. Nombre único
-- por usuario (sin distinguir mayúsculas) para evitar duplicados accidentales; sí se permiten varias
-- ubicaciones con nombres distintos en la misma dirección (p. ej. «Gimnasio Centro» y «Gimnasio Centro
-- (sala 2)»). Máximo 50 ubicaciones por usuario.
--
-- Reversión: sql/090_ubicaciones_habituales_reversion.sql (borra solo esta tabla; las sesiones no se tocan).
-- ============================================================================

create table if not exists public.ubicaciones_habituales (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 60),
  ciudad      text not null check (char_length(btrim(ciudad)) between 1 and 120),
  provincia   text check (provincia is null or char_length(provincia) <= 120),
  direccion   text check (direccion is null or char_length(direccion) <= 200),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.ubicaciones_habituales is
  'Ubicaciones habituales privadas de cada organizador (N09): ayuda para rellenar /publicar. Sin relación con clases: editar o borrar una no cambia sesiones publicadas.';

-- Nombre único por usuario (sin distinguir mayúsculas ni espacios sobrantes)
create unique index if not exists ubicaciones_habituales_nombre_unico
  on public.ubicaciones_habituales (usuario_id, lower(btrim(nombre)));
create index if not exists ubicaciones_habituales_usuario_idx on public.ubicaciones_habituales (usuario_id, nombre);

-- updated_at y límite de 50 por usuario
create or replace function public.ubicaciones_habituales_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.ubicaciones_habituales u where u.usuario_id = new.usuario_id) >= 50 then
      raise exception 'Has alcanzado el máximo de 50 ubicaciones guardadas. Elimina alguna para guardar otra.' using errcode = 'P0001';
    end if;
  else
    -- El dueño no se puede cambiar.
    new.usuario_id := old.usuario_id;
  end if;
  new.nombre := btrim(new.nombre);
  new.ciudad := btrim(new.ciudad);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ubicaciones_habituales_guardar on public.ubicaciones_habituales;
create trigger trg_ubicaciones_habituales_guardar
  before insert or update on public.ubicaciones_habituales
  for each row execute function public.ubicaciones_habituales_antes_de_guardar();

alter table public.ubicaciones_habituales enable row level security;
revoke all on public.ubicaciones_habituales from anon, authenticated;
grant select, insert, update, delete on public.ubicaciones_habituales to authenticated;

drop policy if exists "ver mis ubicaciones" on public.ubicaciones_habituales;
drop policy if exists "crear mis ubicaciones" on public.ubicaciones_habituales;
drop policy if exists "editar mis ubicaciones" on public.ubicaciones_habituales;
drop policy if exists "borrar mis ubicaciones" on public.ubicaciones_habituales;
create policy "ver mis ubicaciones" on public.ubicaciones_habituales
  for select to authenticated using (usuario_id = auth.uid());
create policy "crear mis ubicaciones" on public.ubicaciones_habituales
  for insert to authenticated with check (usuario_id = auth.uid());
create policy "editar mis ubicaciones" on public.ubicaciones_habituales
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "borrar mis ubicaciones" on public.ubicaciones_habituales
  for delete to authenticated using (usuario_id = auth.uid());
