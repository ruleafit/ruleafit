-- ============================================================================
-- Ruleafit · 110_verificaciones_perfil.sql
-- Insignias «Identidad verificada» y «Titulación acreditada».
--
-- Independiente de los pagos: solo depende de 004, 020 y 086. No redefine
-- ninguna función anterior. Se puede ejecutar antes o después de 095-109.
-- Repetible.
--
-- Reglas:
--   · El usuario sube los archivos a su carpeta de un bucket privado y NO puede
--     leerlos, sustituirlos ni borrarlos.
--   · Las solicitudes solo se crean con las funciones de este archivo; aprobar,
--     rechazar y revocar solo lo puede hacer el servidor (service_role).
--   · Las insignias de public.perfiles las calcula la base de datos.
--   · Ningún archivo se borra «a mano»: se apunta en
--     archivos_verificacion_por_borrar y el servidor lo elimina del Storage.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Insignias en el perfil público, protegidas contra la escritura del usuario
-- ----------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists identidad_verificada  boolean not null default false,
  add column if not exists titulacion_acreditada boolean not null default false;

-- NO es security definer a propósito: current_user es el rol real de la
-- petición (anon/authenticated) o el dueño de las funciones de este archivo.
create or replace function public.proteger_insignias_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.identidad_verificada := false;
      new.titulacion_acreditada := false;
    elsif new.identidad_verificada is distinct from old.identidad_verificada
       or new.titulacion_acreditada is distinct from old.titulacion_acreditada then
      raise exception 'Las insignias de verificación no se pueden modificar.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfiles_insignias on public.perfiles;
create trigger trg_perfiles_insignias
  before insert or update on public.perfiles
  for each row execute function public.proteger_insignias_perfil();


-- ----------------------------------------------------------------------------
-- 2) Tablas
-- ----------------------------------------------------------------------------
create table if not exists public.verificaciones_identidad (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid not null references auth.users(id) on delete cascade,
  tipo_documento         text not null check (tipo_documento in ('DNI', 'NIE', 'PASAPORTE')),
  ruta_anverso           text,
  ruta_reverso           text,
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente', 'aprobada', 'rechazada', 'revocada')),
  motivo                 text check (char_length(motivo) <= 500),
  coincide_fiscal        text check (coincide_fiscal in ('coincide', 'no_coincide', 'sin_perfil_fiscal')),
  consentimiento_version text not null,
  consentimiento_en      timestamptz not null default now(),
  avisado_en             timestamptz,
  revisado_en            timestamptz,
  revisado_por           uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- Como mucho una solicitud viva por usuario.
create unique index if not exists verificaciones_identidad_viva
  on public.verificaciones_identidad (usuario_id)
  where estado in ('pendiente', 'aprobada');
create index if not exists verificaciones_identidad_usuario
  on public.verificaciones_identidad (usuario_id, created_at desc);

create table if not exists public.titulaciones (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid not null references auth.users(id) on delete cascade,
  nombre                 text not null check (char_length(nombre) between 3 and 150),
  entidad                text not null check (char_length(entidad) between 2 and 150),
  anio                   integer not null check (anio between 1950 and 2100),
  ruta                   text,
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente', 'aprobada', 'rechazada', 'revocada')),
  motivo                 text check (char_length(motivo) <= 500),
  consentimiento_version text not null,
  consentimiento_en      timestamptz not null default now(),
  avisado_en             timestamptz,
  revisado_en            timestamptz,
  revisado_por           uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists titulaciones_usuario on public.titulaciones (usuario_id, created_at desc);
create unique index if not exists titulaciones_ruta on public.titulaciones (ruta) where ruta is not null;

-- Archivos que el servidor tiene que eliminar del Storage.
create table if not exists public.archivos_verificacion_por_borrar (
  bucket    text not null check (bucket in ('verificaciones-identidad', 'titulaciones')),
  ruta      text not null,
  creado_en timestamptz not null default now(),
  primary key (bucket, ruta)
);


-- ----------------------------------------------------------------------------
-- 3) RLS y permisos: cada usuario lee solo lo suyo; nadie escribe directamente
-- ----------------------------------------------------------------------------
alter table public.verificaciones_identidad enable row level security;
alter table public.titulaciones enable row level security;
alter table public.archivos_verificacion_por_borrar enable row level security;

drop policy if exists "ver mis verificaciones de identidad" on public.verificaciones_identidad;
create policy "ver mis verificaciones de identidad"
  on public.verificaciones_identidad for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists "ver mis titulaciones" on public.titulaciones;
create policy "ver mis titulaciones"
  on public.titulaciones for select to authenticated
  using (auth.uid() = usuario_id);

revoke all on public.verificaciones_identidad from anon, authenticated;
revoke all on public.titulaciones from anon, authenticated;
revoke all on public.archivos_verificacion_por_borrar from anon, authenticated;

grant select (id, usuario_id, tipo_documento, estado, motivo, created_at, revisado_en)
  on public.verificaciones_identidad to authenticated;
grant select (id, usuario_id, nombre, entidad, anio, estado, motivo, created_at, revisado_en)
  on public.titulaciones to authenticated;

grant select, insert, update, delete on public.verificaciones_identidad to service_role;
grant select, insert, update, delete on public.titulaciones to service_role;
grant select, insert, update, delete on public.archivos_verificacion_por_borrar to service_role;


-- ----------------------------------------------------------------------------
-- 4) Triggers: cola de borrado y cálculo de las insignias
-- ----------------------------------------------------------------------------
create or replace function public.encolar_borrado_verificacion(p_bucket text, p_ruta text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.archivos_verificacion_por_borrar (bucket, ruta)
  select p_bucket, p_ruta where p_ruta is not null
  on conflict (bucket, ruta) do nothing;
$$;

-- Al dejar de estar pendiente (aprobada o rechazada), las imágenes del documento
-- de identidad se eliminan siempre (minimización de datos).
create or replace function public.trg_identidad_archivos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta_anverso);
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta_reverso);
    return old;
  end if;
  if new.estado <> 'pendiente' then
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta_anverso);
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta_reverso);
    new.ruta_anverso := null;
    new.ruta_reverso := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_verificaciones_identidad_archivos on public.verificaciones_identidad;
create trigger trg_verificaciones_identidad_archivos
  before update or delete on public.verificaciones_identidad
  for each row execute function public.trg_identidad_archivos();

-- El diploma se conserva mientras está pendiente o aprobado (lo enseña el visor).
create or replace function public.trg_titulacion_archivos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.encolar_borrado_verificacion('titulaciones', old.ruta);
    return old;
  end if;
  if new.estado in ('rechazada', 'revocada') then
    perform public.encolar_borrado_verificacion('titulaciones', old.ruta);
    new.ruta := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_titulaciones_archivos on public.titulaciones;
create trigger trg_titulaciones_archivos
  before update or delete on public.titulaciones
  for each row execute function public.trg_titulacion_archivos();

create or replace function public.recalcular_insignias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := case when tg_op = 'DELETE' then old.usuario_id else new.usuario_id end;
  v_identidad boolean;
  v_titulo boolean;
begin
  v_identidad := exists (select 1 from public.verificaciones_identidad
                          where usuario_id = v_usuario and estado = 'aprobada');
  v_titulo := exists (select 1 from public.titulaciones
                       where usuario_id = v_usuario and estado = 'aprobada');
  update public.perfiles
     set identidad_verificada = v_identidad, titulacion_acreditada = v_titulo
   where id = v_usuario
     and (identidad_verificada, titulacion_acreditada) is distinct from (v_identidad, v_titulo);
  return null;
end;
$$;

drop trigger if exists trg_verificaciones_identidad_insignias on public.verificaciones_identidad;
create trigger trg_verificaciones_identidad_insignias
  after insert or update or delete on public.verificaciones_identidad
  for each row execute function public.recalcular_insignias();

drop trigger if exists trg_titulaciones_insignias on public.titulaciones;
create trigger trg_titulaciones_insignias
  after insert or update or delete on public.titulaciones
  for each row execute function public.recalcular_insignias();


-- ----------------------------------------------------------------------------
-- 5) Funciones del usuario
-- ----------------------------------------------------------------------------
-- Comprueba que la ruta es de la carpeta del usuario y que el archivo existe.
create or replace function public.comprobar_archivo_verificacion(p_bucket text, p_ruta text, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ruta is null
     or p_ruta !~ ('^' || p_usuario::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$')
     or not exists (select 1 from storage.objects where bucket_id = p_bucket and name = p_ruta) then
    raise exception 'No se ha encontrado el archivo subido. Vuelve a adjuntarlo.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.archivos_verificacion_por_borrar where bucket = p_bucket and ruta = p_ruta) then
    raise exception 'Ese archivo ya no es válido. Vuelve a adjuntarlo.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.enviar_verificacion_identidad(
  p_tipo text, p_ruta_anverso text, p_ruta_reverso text, p_consentimiento text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_id uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  -- Serializa los envíos del mismo usuario (límites y duplicados).
  perform pg_advisory_xact_lock(hashtextextended('verificacion:' || v_usuario::text, 0));

  if p_tipo is null or p_tipo not in ('DNI', 'NIE', 'PASAPORTE') then
    raise exception 'Tipo de documento no válido.' using errcode = 'P0001';
  end if;
  if coalesce(p_consentimiento, '') = '' then
    raise exception 'Tienes que aceptar el tratamiento del documento.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.verificaciones_identidad
              where usuario_id = v_usuario and estado in ('pendiente', 'aprobada')) then
    raise exception 'Ya tienes una verificación en revisión o aprobada.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.verificaciones_identidad
       where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Has hecho demasiados envíos hoy. Inténtalo mañana.' using errcode = 'P0001';
  end if;

  perform public.comprobar_archivo_verificacion('verificaciones-identidad', p_ruta_anverso, v_usuario);
  if p_tipo <> 'PASAPORTE' or p_ruta_reverso is not null then
    perform public.comprobar_archivo_verificacion('verificaciones-identidad', p_ruta_reverso, v_usuario);
    if p_ruta_reverso = p_ruta_anverso then
      raise exception 'Adjunta el anverso y el reverso por separado.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.verificaciones_identidad
    (usuario_id, tipo_documento, ruta_anverso, ruta_reverso, consentimiento_version)
  values (v_usuario, p_tipo, p_ruta_anverso, p_ruta_reverso, p_consentimiento)
  returning id into v_id;
  return v_id;
end;
$$;

-- Retirar el consentimiento: borra la solicitud viva (y la insignia).
create or replace function public.retirar_verificacion_identidad()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  delete from public.verificaciones_identidad
   where usuario_id = auth.uid() and estado in ('pendiente', 'aprobada');
end;
$$;

create or replace function public.enviar_titulacion(
  p_nombre text, p_entidad text, p_anio integer, p_ruta text, p_consentimiento text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_entidad text := btrim(coalesce(p_entidad, ''));
  v_id uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verificacion:' || v_usuario::text, 0));

  if char_length(v_nombre) not between 3 and 150 then
    raise exception 'Escribe el nombre del título (de 3 a 150 caracteres).' using errcode = 'P0001';
  end if;
  if char_length(v_entidad) not between 2 and 150 then
    raise exception 'Escribe la entidad emisora (de 2 a 150 caracteres).' using errcode = 'P0001';
  end if;
  if p_anio is null or p_anio < 1950 or p_anio > extract(year from now())::int then
    raise exception 'El año no es válido.' using errcode = 'P0001';
  end if;
  if coalesce(p_consentimiento, '') = '' then
    raise exception 'Tienes que aceptar las condiciones del documento.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.titulaciones
       where usuario_id = v_usuario and estado in ('pendiente', 'aprobada')) >= 10 then
    raise exception 'Puedes tener como máximo 10 titulaciones.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.titulaciones
       where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 15 then
    raise exception 'Has hecho demasiados envíos hoy. Inténtalo mañana.' using errcode = 'P0001';
  end if;

  perform public.comprobar_archivo_verificacion('titulaciones', p_ruta, v_usuario);

  insert into public.titulaciones (usuario_id, nombre, entidad, anio, ruta, consentimiento_version)
  values (v_usuario, v_nombre, v_entidad, p_anio, p_ruta, p_consentimiento)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.retirar_titulacion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  delete from public.titulaciones where id = p_id and usuario_id = auth.uid();
  if not found then
    raise exception 'No se ha encontrado esa titulación.' using errcode = 'P0001';
  end if;
end;
$$;

-- Listado público: solo datos de las titulaciones aprobadas. Nunca la ruta.
create or replace function public.titulaciones_publicas(p_usuario uuid)
returns table (id uuid, nombre text, entidad text, anio integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.nombre, t.entidad, t.anio
    from public.titulaciones t
   where t.usuario_id = p_usuario
     and t.estado = 'aprobada'
     and not public.me_ha_bloqueado(t.usuario_id)
   order by t.anio desc, t.nombre;
$$;


-- ----------------------------------------------------------------------------
-- 6) Funciones de revisión (solo servidor)
-- ----------------------------------------------------------------------------
create or replace function public.resolver_verificacion_identidad(
  p_id uuid, p_decision text, p_motivo text, p_admin uuid, p_coincide_fiscal text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select estado into v_estado from public.verificaciones_identidad where id = p_id for update;
  if v_estado is null then
    raise exception 'La solicitud ya no existe.' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('aprobar', 'rechazar', 'revocar') then
    raise exception 'Decisión no válida.' using errcode = 'P0001';
  end if;
  if v_estado <> (case when p_decision = 'revocar' then 'aprobada' else 'pendiente' end) then
    raise exception 'La solicitud ya se había resuelto. Actualiza la página.' using errcode = 'P0001';
  end if;
  if p_decision <> 'aprobar' and v_motivo is null then
    raise exception 'Escribe el motivo.' using errcode = 'P0001';
  end if;

  update public.verificaciones_identidad
     set estado = case p_decision when 'aprobar' then 'aprobada'
                                  when 'rechazar' then 'rechazada' else 'revocada' end,
         motivo = case when p_decision = 'aprobar' then null else v_motivo end,
         coincide_fiscal = coalesce(p_coincide_fiscal, coincide_fiscal),
         revisado_en = now(),
         revisado_por = p_admin
   where id = p_id;
end;
$$;

create or replace function public.resolver_titulacion(
  p_id uuid, p_decision text, p_motivo text, p_admin uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  select estado into v_estado from public.titulaciones where id = p_id for update;
  if v_estado is null then
    raise exception 'La titulación ya no existe.' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('aprobar', 'rechazar', 'revocar') then
    raise exception 'Decisión no válida.' using errcode = 'P0001';
  end if;
  if v_estado <> (case when p_decision = 'revocar' then 'aprobada' else 'pendiente' end) then
    raise exception 'La titulación ya se había resuelto. Actualiza la página.' using errcode = 'P0001';
  end if;
  if p_decision <> 'aprobar' and v_motivo is null then
    raise exception 'Escribe el motivo.' using errcode = 'P0001';
  end if;

  update public.titulaciones
     set estado = case p_decision when 'aprobar' then 'aprobada'
                                  when 'rechazar' then 'rechazada' else 'revocada' end,
         motivo = case when p_decision = 'aprobar' then null else v_motivo end,
         revisado_en = now(),
         revisado_por = p_admin
   where id = p_id;
end;
$$;

-- Archivos subidos hace más de 24 h que no pertenecen a ninguna solicitud.
create or replace function public.encolar_huerfanos_verificacion()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into public.archivos_verificacion_por_borrar (bucket, ruta)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id in ('verificaciones-identidad', 'titulaciones')
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.verificaciones_identidad v
                      where o.bucket_id = 'verificaciones-identidad'
                        and (v.ruta_anverso = o.name or v.ruta_reverso = o.name))
     and not exists (select 1 from public.titulaciones t
                      where o.bucket_id = 'titulaciones' and t.ruta = o.name)
  on conflict (bucket, ruta) do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7) Storage: dos buckets privados. Solo subida a la carpeta propia.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('verificaciones-identidad', 'verificaciones-identidad', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('titulaciones', 'titulaciones', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Tope de archivos subidos por usuario y día (evita llenar el almacenamiento).
create or replace function public.puede_subir_verificacion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    select count(*) from storage.objects
     where bucket_id in ('verificaciones-identidad', 'titulaciones')
       and (storage.foldername(name))[1] = auth.uid()::text
       and created_at > now() - interval '24 hours'
  ) < 40;
$$;

drop policy if exists "verificaciones: subir a la carpeta propia" on storage.objects;
create policy "verificaciones: subir a la carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('verificaciones-identidad', 'titulaciones')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.puede_subir_verificacion()
  );


-- ----------------------------------------------------------------------------
-- 8) Permisos de las funciones
-- ----------------------------------------------------------------------------
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'proteger_insignias_perfil()',
    'encolar_borrado_verificacion(text, text)',
    'trg_identidad_archivos()',
    'trg_titulacion_archivos()',
    'recalcular_insignias()',
    'comprobar_archivo_verificacion(text, text, uuid)',
    'enviar_verificacion_identidad(text, text, text, text)',
    'retirar_verificacion_identidad()',
    'enviar_titulacion(text, text, integer, text, text)',
    'retirar_titulacion(uuid)',
    'titulaciones_publicas(uuid)',
    'resolver_verificacion_identidad(uuid, text, text, uuid, text)',
    'resolver_titulacion(uuid, text, text, uuid)',
    'encolar_huerfanos_verificacion()',
    'puede_subir_verificacion()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', v_funcion);
  end loop;
end;
$$;

-- El trigger de perfiles se ejecuta con el rol de la petición.
grant execute on function public.proteger_insignias_perfil() to anon, authenticated, service_role;
grant execute on function public.enviar_verificacion_identidad(text, text, text, text) to authenticated;
grant execute on function public.retirar_verificacion_identidad() to authenticated;
grant execute on function public.enviar_titulacion(text, text, integer, text, text) to authenticated;
grant execute on function public.retirar_titulacion(uuid) to authenticated;
grant execute on function public.puede_subir_verificacion() to authenticated;
grant execute on function public.titulaciones_publicas(uuid) to anon, authenticated, service_role;
grant execute on function public.resolver_verificacion_identidad(uuid, text, text, uuid, text) to service_role;
grant execute on function public.resolver_titulacion(uuid, text, text, uuid) to service_role;
grant execute on function public.encolar_huerfanos_verificacion() to service_role;
