-- ============================================================================
-- Ruleafit · 112_verificacion_automatica_centros.sql
-- Comprobación automática de identidad y nueva insignia «Centro verificado».
--
-- Requiere 110 y 111. Independiente de los pagos. Repetible. Redefine solo
-- funciones de 110 (proteger_insignias_perfil, encolar_huerfanos_verificacion):
-- no volver a ejecutar 110 después de este archivo.
--
-- La decisión automática la toma el servidor de la web; aquí solo se guarda.
-- Los documentos no los ve ningún usuario: solo el administrador.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Insignia de centro, protegida como las demás
-- ----------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists centro_verificado boolean not null default false;

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
      new.centro_verificado := false;
    elsif new.identidad_verificada is distinct from old.identidad_verificada
       or new.titulacion_acreditada is distinct from old.titulacion_acreditada
       or new.centro_verificado is distinct from old.centro_verificado then
      raise exception 'Las insignias de verificación no se pueden modificar.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2) Identidad: cómo se resolvió y huella del documento
--    La huella (HMAC calculado en el servidor, nunca el número) impide que un
--    mismo documento verifique dos cuentas.
-- ----------------------------------------------------------------------------
alter table public.verificaciones_identidad
  add column if not exists metodo text,
  add column if not exists analizado_en timestamptz,
  add column if not exists documento_hash text;

alter table public.verificaciones_identidad drop constraint if exists verificaciones_identidad_metodo_check;
alter table public.verificaciones_identidad
  add constraint verificaciones_identidad_metodo_check check (metodo in ('automatico', 'manual'));

create unique index if not exists verificaciones_identidad_documento
  on public.verificaciones_identidad (documento_hash)
  where estado = 'aprobada' and documento_hash is not null;


-- ----------------------------------------------------------------------------
-- 3) Centros
-- ----------------------------------------------------------------------------
create table if not exists public.verificaciones_centro (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid not null references auth.users(id) on delete cascade,
  razon_social           text not null check (char_length(razon_social) between 2 and 200),
  cif                    text not null check (cif ~ '^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$'),
  ruta                   text,
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente', 'aprobada', 'rechazada', 'revocada')),
  motivo                 text check (char_length(motivo) <= 500),
  metodo                 text check (metodo in ('automatico', 'manual')),
  consentimiento_version text not null,
  consentimiento_en      timestamptz not null default now(),
  analizado_en           timestamptz,
  avisado_en             timestamptz,
  revisado_en            timestamptz,
  revisado_por           uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

create unique index if not exists verificaciones_centro_viva
  on public.verificaciones_centro (usuario_id)
  where estado in ('pendiente', 'aprobada');
create unique index if not exists verificaciones_centro_cif
  on public.verificaciones_centro (cif)
  where estado = 'aprobada';
create index if not exists verificaciones_centro_usuario
  on public.verificaciones_centro (usuario_id, created_at desc);

alter table public.verificaciones_centro enable row level security;

drop policy if exists "ver mis verificaciones de centro" on public.verificaciones_centro;
create policy "ver mis verificaciones de centro"
  on public.verificaciones_centro for select to authenticated
  using (auth.uid() = usuario_id);

revoke all on public.verificaciones_centro from anon, authenticated;
grant select (id, usuario_id, razon_social, cif, estado, motivo, created_at, revisado_en)
  on public.verificaciones_centro to authenticated;
grant select, insert, update, delete on public.verificaciones_centro to service_role;

-- La documentación del centro se elimina al aprobar, rechazar o retirar. Comparte
-- bucket privado con la identidad.
create or replace function public.trg_centro_archivos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta);
    return old;
  end if;
  if new.estado <> 'pendiente' then
    perform public.encolar_borrado_verificacion('verificaciones-identidad', old.ruta);
    new.ruta := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_verificaciones_centro_archivos on public.verificaciones_centro;
create trigger trg_verificaciones_centro_archivos
  before update or delete on public.verificaciones_centro
  for each row execute function public.trg_centro_archivos();

create or replace function public.recalcular_insignia_centro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := case when tg_op = 'DELETE' then old.usuario_id else new.usuario_id end;
  v_centro boolean;
begin
  v_centro := exists (select 1 from public.verificaciones_centro
                       where usuario_id = v_usuario and estado = 'aprobada');
  update public.perfiles set centro_verificado = v_centro
   where id = v_usuario and centro_verificado is distinct from v_centro;
  return null;
end;
$$;

drop trigger if exists trg_verificaciones_centro_insignia on public.verificaciones_centro;
create trigger trg_verificaciones_centro_insignia
  after insert or update or delete on public.verificaciones_centro
  for each row execute function public.recalcular_insignia_centro();


-- ----------------------------------------------------------------------------
-- 4) Funciones del usuario, del público y del servidor
-- ----------------------------------------------------------------------------
create or replace function public.enviar_verificacion_centro(
  p_razon_social text, p_cif text, p_ruta text, p_consentimiento text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_razon text := btrim(coalesce(p_razon_social, ''));
  v_cif text := upper(regexp_replace(coalesce(p_cif, ''), '[^0-9A-Za-z]', '', 'g'));
  v_id uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verificacion:' || v_usuario::text, 0));

  if char_length(v_razon) not between 2 and 200 then
    raise exception 'Escribe la razón social del centro.' using errcode = 'P0001';
  end if;
  if v_cif !~ '^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$' then
    raise exception 'El CIF no es válido.' using errcode = 'P0001';
  end if;
  if coalesce(p_consentimiento, '') = '' then
    raise exception 'Tienes que aceptar el tratamiento del documento.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.verificaciones_centro
              where usuario_id = v_usuario and estado in ('pendiente', 'aprobada')) then
    raise exception 'Ya tienes un centro en revisión o verificado.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.verificaciones_centro
       where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Has hecho demasiados envíos hoy. Inténtalo mañana.' using errcode = 'P0001';
  end if;

  perform public.comprobar_archivo_verificacion('verificaciones-identidad', p_ruta, v_usuario);
  if exists (select 1 from public.verificaciones_identidad
              where ruta_anverso = p_ruta or ruta_reverso = p_ruta) then
    raise exception 'Adjunta el documento del centro.' using errcode = 'P0001';
  end if;

  insert into public.verificaciones_centro (usuario_id, razon_social, cif, ruta, consentimiento_version)
  values (v_usuario, v_razon, v_cif, p_ruta, p_consentimiento)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.retirar_verificacion_centro()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  delete from public.verificaciones_centro
   where usuario_id = auth.uid() and estado in ('pendiente', 'aprobada');
end;
$$;

-- Nombre del centro verificado, para enseñarlo junto a la insignia. Sin CIF.
create or replace function public.centro_publico(p_usuario uuid)
returns table (razon_social text)
language sql
stable
security definer
set search_path = public
as $$
  select c.razon_social
    from public.verificaciones_centro c
   where c.usuario_id = p_usuario
     and c.estado = 'aprobada'
     and not public.me_ha_bloqueado(c.usuario_id);
$$;

create or replace function public.resolver_verificacion_centro(
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
  select estado into v_estado from public.verificaciones_centro where id = p_id for update;
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

  update public.verificaciones_centro
     set estado = case p_decision when 'aprobar' then 'aprobada'
                                  when 'rechazar' then 'rechazada' else 'revocada' end,
         motivo = case when p_decision = 'aprobar' then null else v_motivo end,
         revisado_en = now(),
         revisado_por = p_admin
   where id = p_id;
end;
$$;

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
     and not exists (select 1 from public.verificaciones_centro c
                      where o.bucket_id = 'verificaciones-identidad' and c.ruta = o.name)
     and not exists (select 1 from public.titulaciones t
                      where o.bucket_id = 'titulaciones' and t.ruta = o.name)
  on conflict (bucket, ruta) do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5) Permisos de las funciones nuevas
-- ----------------------------------------------------------------------------
do $$
declare
  v_funcion text;
begin
  foreach v_funcion in array array[
    'trg_centro_archivos()',
    'recalcular_insignia_centro()',
    'enviar_verificacion_centro(text, text, text, text)',
    'retirar_verificacion_centro()',
    'centro_publico(uuid)',
    'resolver_verificacion_centro(uuid, text, text, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', v_funcion);
  end loop;
end;
$$;

grant execute on function public.enviar_verificacion_centro(text, text, text, text) to authenticated;
grant execute on function public.retirar_verificacion_centro() to authenticated;
grant execute on function public.centro_publico(uuid) to anon, authenticated, service_role;
grant execute on function public.resolver_verificacion_centro(uuid, text, text, uuid) to service_role;
