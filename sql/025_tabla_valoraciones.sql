-- ============================================================================
-- Openfit · 025_tabla_valoraciones.sql
-- Tabla public.valoraciones: valoraciones de clientes a entrenadores
-- (1 a 5 estrellas + opinión escrita opcional), visibles públicamente en el
-- perfil del entrenador. Solo puede valorar quien haya asistido a alguna
-- clase de ese entrenador; una valoración por par (cliente, entrenador),
-- editable.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, DROP CONSTRAINT/POLICY IF EXISTS
-- antes de cada ADD CONSTRAINT / CREATE POLICY, para poder reejecutar el
-- archivo sin error.
--
-- Depende de sql/004_perfiles.sql (tabla public.perfiles) y
-- sql/001_reservas.sql + sql/006_open_fidelizacion.sql (tablas
-- public.clases / public.reservas y columna reservas.asistencia), ya
-- ejecutadas.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Tabla public.valoraciones
--    cliente_id y entrenador_id referencian public.perfiles(id) (no
--    auth.users(id) directamente) para poder hacer embeds de username desde
--    el frontend (select('*, perfiles:cliente_id(username)')), mismo motivo
--    que llevó a añadir la FK de clases.trainer_id a perfiles en
--    sql/019_fk_clases_perfiles_y_rls_publica.sql.
-- ----------------------------------------------------------------------------
create table if not exists public.valoraciones (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.perfiles(id) on delete cascade,
  entrenador_id uuid not null references public.perfiles(id) on delete cascade,
  estrellas     smallint not null,
  opinion       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.valoraciones
  drop constraint if exists valoraciones_estrellas_rango;

alter table public.valoraciones
  add constraint valoraciones_estrellas_rango
  check (estrellas between 1 and 5);

-- ~100 palabras con margen; el límite real de 100 palabras se controla en
-- frontend, este CHECK es solo una red de seguridad en caracteres (mismo
-- patrón que sql/022_ampliar_limite_descripcion.sql).
alter table public.valoraciones
  drop constraint if exists valoraciones_opinion_longitud;

alter table public.valoraciones
  add constraint valoraciones_opinion_longitud
  check (opinion is null or char_length(opinion) <= 750);

alter table public.valoraciones
  drop constraint if exists valoraciones_cliente_entrenador_unique;

alter table public.valoraciones
  add constraint valoraciones_cliente_entrenador_unique
  unique (cliente_id, entrenador_id);

comment on table public.valoraciones is
  'Valoraciones de clientes a entrenadores (1 a 5 estrellas + opinión escrita opcional), públicas, mostradas en el perfil del entrenador. Una valoración por par (cliente_id, entrenador_id), editable. Solo puede insertar/editar quien haya asistido a alguna clase del entrenador valorado (ver políticas RLS de INSERT/UPDATE).';
comment on column public.valoraciones.id is
  'Identificador único de la valoración.';
comment on column public.valoraciones.cliente_id is
  'Cliente autor de la valoración. Referencia a public.perfiles(id), on delete cascade.';
comment on column public.valoraciones.entrenador_id is
  'Entrenador valorado. Referencia a public.perfiles(id), on delete cascade.';
comment on column public.valoraciones.estrellas is
  'Puntuación de 1 a 5 estrellas (ver valoraciones_estrellas_rango).';
comment on column public.valoraciones.opinion is
  'Opinión escrita opcional, hasta ~100 palabras (límite real en frontend); ver valoraciones_opinion_longitud para el límite de caracteres en base de datos.';
comment on column public.valoraciones.created_at is
  'Fecha y hora de creación de la valoración.';
comment on column public.valoraciones.updated_at is
  'Fecha y hora de la última edición de la valoración.';


-- ----------------------------------------------------------------------------
-- 2) RLS: lectura pública; INSERT/UPDATE solo del propio cliente y solo si
--    ha asistido a alguna clase del entrenador valorado; sin política de
--    DELETE.
-- ----------------------------------------------------------------------------
alter table public.valoraciones enable row level security;

drop policy if exists "valoraciones visibles publicamente" on public.valoraciones;

create policy "valoraciones visibles publicamente"
  on public.valoraciones
  for select
  to public
  using (true);

drop policy if exists "cliente inserta valoracion si asistio" on public.valoraciones;

create policy "cliente inserta valoracion si asistio"
  on public.valoraciones
  for insert
  to authenticated
  with check (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.asistencia = 'asistio'
    )
  );

drop policy if exists "cliente edita su propia valoracion si asistio" on public.valoraciones;

create policy "cliente edita su propia valoracion si asistio"
  on public.valoraciones
  for update
  to authenticated
  using (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.asistencia = 'asistio'
    )
  )
  with check (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.asistencia = 'asistio'
    )
  );

-- Sin política de DELETE: queda bloqueado para authenticated y anon por
-- defecto en cuanto RLS está activo.
