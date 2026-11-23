-- ============================================================================
-- Ruleafit · 091_solicitudes_centros.sql
-- N15 · Alta guiada de gimnasios y centros deportivos: registro PRIVADO de solicitudes del formulario
-- público de /centros.
--
-- CÓMO SE GUARDAN: el formulario de /centros llama a un endpoint del servidor (/api/centros/solicitud), que valida
-- los datos y llama a registrar_solicitud_centro() con la clave de servicio. La tabla NO tiene políticas de
-- lectura ni escritura para anon/authenticated: nadie desde el navegador puede ver, crear ni modificar
-- solicitudes. Se consultan y gestionan desde Supabase (panel/SQL con la clave de servicio).
--
-- ESTADOS DE SEGUIMIENTO (internos): nuevo → contactado → demo_pendiente → registrado → activo.
--   Inicial: 'nuevo'. NUNCA se pasa solos a 'registrado' o 'activo' por coincidir un correo: la vinculación con
--   una cuenta (usuario_id) es manual y opcional.
--
-- PROTECCIONES: validación y longitudes (CHECK), consentimiento de privacidad obligatorio (se guarda su fecha),
-- duplicados (mismo correo y centro en 24 h = misma solicitud, sin crear otra ni repetir el aviso), máximo 3
-- solicitudes por correo al día y límites globales (20 por hora y 100 por día) contra envíos masivos, bloqueo
-- consultivo por correo contra dobles envíos simultáneos. No se guarda la IP ni datos de navegación.
--
-- Reversión: sql/091_solicitudes_centros_reversion.sql
-- ============================================================================

create table if not exists public.solicitudes_centros (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  centro                  text not null check (char_length(centro) between 2 and 100),
  ciudad                  text not null check (char_length(ciudad) between 2 and 80),
  contacto                text not null check (char_length(contacto) between 2 and 80),
  email                   text not null check (char_length(email) between 5 and 120 and email = lower(email)),
  telefono                text check (telefono is null or char_length(telefono) between 6 and 20),
  tipo                    text not null check (tipo in ('demostracion', 'informacion', 'ayuda')),
  mensaje                 text check (mensaje is null or char_length(mensaje) <= 1000),
  estado                  text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'demo_pendiente', 'registrado', 'activo')),
  privacidad_aceptada_at  timestamptz not null,
  aviso_enviado_at        timestamptz,
  aviso_intentos          integer not null default 0,
  usuario_id              uuid references public.perfiles(id) on delete set null,   -- vinculación MANUAL y opcional
  notas                   text check (notas is null or char_length(notas) <= 2000)  -- notas internas de seguimiento
);

comment on table public.solicitudes_centros is
  'Solicitudes del formulario público /centros (N15). Privada: sin acceso para anon/authenticated; se gestiona desde Supabase.';
comment on column public.solicitudes_centros.estado is
  'Seguimiento interno: nuevo, contactado, demo_pendiente, registrado, activo. No cambia solo.';

create index if not exists solicitudes_centros_created_idx on public.solicitudes_centros (created_at desc);
create index if not exists solicitudes_centros_email_idx on public.solicitudes_centros (email, created_at desc);

create or replace function public.solicitudes_centros_tocar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_solicitudes_centros_tocar on public.solicitudes_centros;
create trigger trg_solicitudes_centros_tocar before update on public.solicitudes_centros
  for each row execute function public.solicitudes_centros_tocar();

alter table public.solicitudes_centros enable row level security;
revoke all on public.solicitudes_centros from anon, authenticated;

-- Registro de una solicitud (solo la ejecuta el servidor con la clave de servicio).
-- Devuelve { id, nuevo, aviso_pendiente }: nuevo=false si ya existía (doble envío) y aviso_pendiente indica que
-- todavía no se ha podido enviar el correo de aviso (el servidor lo reintenta sin crear otra solicitud).
create or replace function public.registrar_solicitud_centro(
  p_centro     text,
  p_ciudad     text,
  p_contacto   text,
  p_email      text,
  p_telefono   text,
  p_tipo       text,
  p_mensaje    text,
  p_privacidad boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_centro  text := btrim(coalesce(p_centro, ''));
  v_existe  record;
  v_id      uuid;
  v_hora    integer;
  v_dia     integer;
  v_por_mail integer;
begin
  if p_privacidad is distinct from true then
    raise exception 'Hay que aceptar la política de privacidad.' using errcode = 'P0001';
  end if;

  -- Un solo envío a la vez por correo (doble clic, dos pestañas…).
  perform pg_advisory_xact_lock(hashtext('solicitud_centro:' || v_email));

  -- Doble envío: misma solicitud (correo + centro) en las últimas 24 h → la misma, sin duplicar.
  select id, aviso_enviado_at into v_existe
    from public.solicitudes_centros
   where email = v_email and lower(centro) = lower(v_centro) and created_at > now() - interval '24 hours'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('id', v_existe.id, 'nuevo', false, 'aviso_pendiente', v_existe.aviso_enviado_at is null);
  end if;

  -- Límites contra envíos masivos.
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*) filter (where created_at > now() - interval '1 day')
    into v_hora, v_dia
    from public.solicitudes_centros where created_at > now() - interval '1 day';
  if v_hora >= 20 or v_dia >= 100 then
    raise exception 'limite_global' using errcode = 'P0001';
  end if;
  select count(*) into v_por_mail from public.solicitudes_centros where email = v_email and created_at > now() - interval '1 day';
  if v_por_mail >= 3 then
    raise exception 'limite_correo' using errcode = 'P0001';
  end if;

  insert into public.solicitudes_centros (centro, ciudad, contacto, email, telefono, tipo, mensaje, privacidad_aceptada_at)
  values (v_centro, btrim(p_ciudad), btrim(p_contacto), v_email, nullif(btrim(coalesce(p_telefono, '')), ''), p_tipo,
          nullif(btrim(coalesce(p_mensaje, '')), ''), now())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nuevo', true, 'aviso_pendiente', true);
end;
$$;

revoke all on function public.registrar_solicitud_centro(text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.registrar_solicitud_centro(text, text, text, text, text, text, text, boolean) to service_role;
