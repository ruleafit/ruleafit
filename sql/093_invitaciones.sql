-- ============================================================================
-- Ruleafit · 093_invitaciones.sql
-- C25 · «Invita a tus amigos»: enlace personal de invitación y recompensa de 20 Rulos para cada parte.
--
-- RULOS: el invitado conserva sus 20 Rulos de bienvenida habituales (no se tocan) y recibe 20 EXTRA por la invitación
-- (40 en total). El invitador recibe 20.
--
-- DISEÑO
--  · codigos_invitacion: UN código permanente por usuario (8 caracteres aleatorios, sin datos personales).
--  · invitaciones_abiertas: «billete» de un solo uso que el servidor emite cuando alguien ABRE un enlace de invitación
--    (abrir_invitacion). El billete es el que viaja con el registro (no el código). Guarda CUÁNDO se abrió.
--  · ATRIBUCIÓN LIGADA A LA CREACIÓN DE LA CUENTA: solo recibe recompensa una cuenta creada DESPUÉS de abrir el enlace
--    (auth.users.created_at >= billete.created_at). Una cuenta que ya existía antes no puede reclamar nada, y el billete
--    es de un solo uso. El invitado se marca en `invitaciones` (privada; clave primaria = una sola atribución).
--  · aplicar_invitacion(): única vía de concesión. En UNA transacción registra la invitación, concede +20 a cada cuenta
--    con el libro de Rulos existente (otorgar_rulos) y deja un aviso en la campana. Atómica e idempotente.
--  · Entradas:
--      1) Alta con correo: el formulario envía el billete en los metadatos del alta y un trigger sobre auth.users lo aplica
--         cuando la cuenta queda CONFIRMADA (al insertar si ya viene confirmada, o al confirmar el correo; nunca antes).
--      2) Google (y respaldo): reclamar_invitacion(billete) la llama el propio usuario recién creado.
--  · RECUPERACIÓN: el trigger está blindado (un fallo NUNCA impide un alta ni una confirmación), pero un fallo temporal
--    no pierde la recompensa: el billete sigue «abierto» y recuperar_invitaciones() (cron, ver 093_invitaciones_cron.sql)
--    reintenta de forma idempotente las cuentas confirmadas con billete aún abierto. Los rechazos definitivos
--    (cuenta anterior, auto-invitación, caducado) marcan el billete como «rechazado» y no se reintentan.
--  · La cantidad (20) está en la función: el navegador solo aporta un billete que el servidor valida.
--  · No modifica funciones existentes (otorgar_rulos, bienvenida, generar_notificacion) ni tablas de pagos.
--
-- Reversión: sql/093_invitaciones_reversion.sql
-- ============================================================================

insert into public.rulos_motivos (codigo, descripcion) values
  ('invitacion_enviada', 'Una persona se ha registrado con tu enlace de invitación'),
  ('invitacion_recibida', 'Rulos extra por registrarte con una invitación')
on conflict (codigo) do nothing;

create table if not exists public.codigos_invitacion (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  codigo     text not null unique check (codigo ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.invitaciones_abiertas (
  ticket     uuid primary key default gen_random_uuid(),
  codigo     text not null,
  created_at timestamptz not null default now(),
  estado     text not null default 'abierto' check (estado in ('abierto', 'usado', 'rechazado')),
  usado_por  uuid,
  usado_at   timestamptz
);
create index if not exists invitaciones_abiertas_estado_idx on public.invitaciones_abiertas (created_at) where estado = 'abierto';

create table if not exists public.invitaciones (
  invitado_id  uuid primary key references auth.users(id) on delete cascade,   -- una cuenta nueva = un solo invitador
  invitador_id uuid not null references auth.users(id) on delete cascade,
  codigo       text not null,
  created_at   timestamptz not null default now(),
  check (invitado_id <> invitador_id)
);
create index if not exists invitaciones_invitador_idx on public.invitaciones (invitador_id);

alter table public.codigos_invitacion enable row level security;
alter table public.invitaciones_abiertas enable row level security;
alter table public.invitaciones enable row level security;
revoke all on public.codigos_invitacion from anon, authenticated;
revoke all on public.invitaciones_abiertas from anon, authenticated;
revoke all on public.invitaciones from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Código personal (se crea la primera vez y es permanente).
-- ---------------------------------------------------------------------------
create or replace function public.mi_codigo_invitacion()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_codigo text;
  v_intentos integer := 0;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select codigo into v_codigo from public.codigos_invitacion where usuario_id = v_uid;
  if v_codigo is not null then
    return v_codigo;
  end if;
  if not exists (select 1 from public.perfiles where id = v_uid) then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.codigos_invitacion (usuario_id, codigo) values (v_uid, v_codigo)
        on conflict (usuario_id) do nothing;
      select codigo into v_codigo from public.codigos_invitacion where usuario_id = v_uid;
      return v_codigo;
    exception when unique_violation then
      v_intentos := v_intentos + 1;
      if v_intentos > 10 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abrir un enlace de invitación: emite un billete de un solo uso (o null si el código no existe).
-- Lo usa la página /invita/<código> (visitantes sin sesión). No revela de quién es el código.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_invitacion(p_codigo text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_ticket uuid;
begin
  if v_codigo !~ '^[A-Z0-9]{8}$' or not exists (select 1 from public.codigos_invitacion where codigo = v_codigo) then
    return null;
  end if;
  -- Freno sencillo contra aperturas masivas (el billete es solo un justificante; no concede nada por sí mismo).
  if (select count(*) from public.invitaciones_abiertas where created_at > now() - interval '1 minute') > 300 then
    return null;
  end if;
  -- Limpieza oportunista de billetes antiguos.
  delete from public.invitaciones_abiertas where created_at < now() - interval '45 days';
  insert into public.invitaciones_abiertas (codigo) values (v_codigo) returning ticket into v_ticket;
  return v_ticket;
end;
$$;

-- ---------------------------------------------------------------------------
-- Concesión (INTERNA): atómica e idempotente.
-- Devuelve: 'concedida' | 'ya_atribuida' | 'invalida' | 'usado' | 'rechazada' | 'caducada' | 'propia' | 'no_nueva'
-- Un error inesperado se propaga (nada queda aplicado) y el billete sigue abierto para reintentar.
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_invitacion(p_invitado uuid, p_ticket text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ticket    uuid;
  v_fila      public.invitaciones_abiertas%rowtype;
  v_invitador uuid;
  v_creada    timestamptz;
  v_filas     integer;
begin
  if p_invitado is null or p_ticket is null or btrim(p_ticket) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return 'invalida';
  end if;
  v_ticket := btrim(p_ticket)::uuid;

  -- Un solo proceso a la vez por cuenta (callbacks simultáneos).
  perform pg_advisory_xact_lock(hashtext('invitacion:' || p_invitado::text));

  if exists (select 1 from public.invitaciones where invitado_id = p_invitado) then
    return 'ya_atribuida';
  end if;

  select * into v_fila from public.invitaciones_abiertas where ticket = v_ticket for update;
  if not found then
    return 'invalida';
  end if;
  if v_fila.estado = 'usado' then
    return 'usado';
  end if;
  if v_fila.estado = 'rechazado' then
    return 'rechazada';
  end if;
  if v_fila.created_at < now() - interval '30 days' then
    update public.invitaciones_abiertas set estado = 'rechazado' where ticket = v_ticket;
    return 'caducada';
  end if;

  select usuario_id into v_invitador from public.codigos_invitacion where codigo = v_fila.codigo;
  if v_invitador is null or not exists (select 1 from auth.users where id = v_invitador) then
    return 'invalida'; -- el invitador ya no existe: no se concede y el registro continúa con normalidad
  end if;
  if v_invitador = p_invitado then
    update public.invitaciones_abiertas set estado = 'rechazado' where ticket = v_ticket;
    return 'propia';
  end if;

  -- Cuenta REALMENTE nueva: creada después de abrir el enlace. Una cuenta anterior nunca puede reclamar.
  select created_at into v_creada from auth.users where id = p_invitado;
  if v_creada is null or v_creada < v_fila.created_at then
    update public.invitaciones_abiertas set estado = 'rechazado' where ticket = v_ticket;
    return 'no_nueva';
  end if;

  insert into public.invitaciones (invitado_id, invitador_id, codigo)
  values (p_invitado, v_invitador, v_fila.codigo)
  on conflict (invitado_id) do nothing;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    return 'ya_atribuida';
  end if;

  update public.invitaciones_abiertas
     set estado = 'usado', usado_por = p_invitado, usado_at = now()
   where ticket = v_ticket;

  -- +20 a cada cuenta con el libro existente (el invitado además conserva sus 20 de bienvenida). Sin referencias a la otra
  -- persona: nadie ve identidades.
  perform public.otorgar_rulos(v_invitador, 20, 'invitacion_enviada', null, null, null, null);
  perform public.otorgar_rulos(p_invitado, 20, 'invitacion_recibida', null, null, null, null);

  insert into public.notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
  values
    (v_invitador, 'invitacion_recompensa', '¡Tu invitación ha dado sus frutos!', 'Has ganado 20 Rulos', '/cuenta#mis-rulos'),
    (p_invitado, 'invitacion_recompensa', '¡Bienvenido a RuleaFit!', 'Has conseguido 20 Rulos por tu invitación', '/cuenta#mis-rulos');

  return 'concedida';
end;
$$;

-- El propio usuario recién creado reclama su invitación (Google, y respaldo del correo).
create or replace function public.reclamar_invitacion(p_ticket text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  return jsonb_build_object('estado', public.aplicar_invitacion(v_uid, p_ticket));
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta con correo: se aplica cuando la cuenta queda confirmada. BLINDADO: nunca rompe un alta ni una confirmación.
-- Si falla de forma temporal, el billete queda abierto y lo recupera recuperar_invitaciones().
-- ---------------------------------------------------------------------------
create or replace function public.procesar_invitacion_alta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if (tg_op = 'INSERT' and new.email_confirmed_at is not null)
       or (tg_op = 'UPDATE' and old.email_confirmed_at is null and new.email_confirmed_at is not null) then
      perform public.aplicar_invitacion(new.id, new.raw_user_meta_data ->> 'invitacion');
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists on_auth_user_invitacion on auth.users;
create trigger on_auth_user_invitacion
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.procesar_invitacion_alta();

-- ---------------------------------------------------------------------------
-- Recuperación (cron): cuentas CONFIRMADAS con un billete en sus metadatos que sigue «abierto» y aún sin invitación.
-- Reintento idempotente; cada cuenta en su propio bloque para que una no bloquee a las demás. Devuelve las concedidas.
-- ---------------------------------------------------------------------------
create or replace function public.recuperar_invitaciones()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cuenta record;
  v_total  integer := 0;
begin
  for v_cuenta in
    select u.id, u.raw_user_meta_data ->> 'invitacion' as ticket
      from auth.users u
     where u.email_confirmed_at is not null
       and u.created_at > now() - interval '30 days'
       and u.raw_user_meta_data ? 'invitacion'
       and not exists (select 1 from public.invitaciones i where i.invitado_id = u.id)
       and exists (select 1 from public.invitaciones_abiertas t
                    where t.estado = 'abierto' and t.ticket::text = lower(btrim(u.raw_user_meta_data ->> 'invitacion')))
     limit 100
  loop
    begin
      if public.aplicar_invitacion(v_cuenta.id, v_cuenta.ticket) = 'concedida' then
        v_total := v_total + 1;
      end if;
    exception when others then
      -- Queda en el registro de Postgres (se ve en los logs de Supabase) y se reintentará en la siguiente pasada.
      raise warning 'recuperar_invitaciones: fallo con la cuenta % (%): %', v_cuenta.id, sqlstate, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.mi_codigo_invitacion() from public, anon, authenticated;
revoke all on function public.abrir_invitacion(text) from public, anon, authenticated;
revoke all on function public.aplicar_invitacion(uuid, text) from public, anon, authenticated;
revoke all on function public.reclamar_invitacion(text) from public, anon, authenticated;
revoke all on function public.procesar_invitacion_alta() from public, anon, authenticated;
revoke all on function public.recuperar_invitaciones() from public, anon, authenticated;
grant execute on function public.mi_codigo_invitacion() to authenticated;
grant execute on function public.reclamar_invitacion(text) to authenticated;
grant execute on function public.abrir_invitacion(text) to anon, authenticated;
grant execute on function public.recuperar_invitaciones() to service_role;
