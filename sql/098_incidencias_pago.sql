-- ============================================================================
-- Ruleafit · 098_incidencias_pago.sql
-- Pendiente 35: centro de incidencias y reclamaciones ECONÓMICAS (cobro, cancelación o reembolso),
-- separado del feedback general. Requiere sql/071 y sql/087.
-- No activa pagos ni mueve dinero: una incidencia es solo un expediente con número y estado.
--
--  · incidencias_pago: un caso por fila. Número RF-AAAA-NNNNNN.
--  · incidencias_pago_eventos: historial inmutable de estados y respuestas.
--  · abrir_incidencia()      usuario autenticado, solo sobre SUS reservas.
--  · actualizar_incidencia() solo servicio (panel de administración).
--  · Si se elimina la cuenta, el caso se conserva sin vínculo con la persona y sin el texto libre.
--
-- Reversión: sql/098_incidencias_pago_reversion.sql
-- ============================================================================

create sequence if not exists public.incidencias_pago_numero_seq;
revoke all on sequence public.incidencias_pago_numero_seq from public, anon, authenticated;

create table if not exists public.incidencias_pago (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,
  usuario_id      uuid references auth.users(id) on delete set null,
  reserva_id      uuid references public.reservas(id) on delete set null,
  cobro_id        uuid references public.cobros(id) on delete set null,
  clase_titulo    text not null,
  clase_fecha     date,
  tipo            text not null check (tipo in ('cobro', 'cancelacion', 'reembolso')),
  descripcion     text not null check (char_length(descripcion) between 10 and 1000),
  estado          text not null default 'abierta'
                    check (estado in ('abierta', 'en_revision', 'resuelta', 'rechazada')),
  respuesta       text check (char_length(respuesta) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  cerrada_en      timestamptz
);

create index if not exists incidencias_pago_usuario_idx on public.incidencias_pago (usuario_id, created_at desc);
create index if not exists incidencias_pago_estado_idx on public.incidencias_pago (estado, created_at);
-- Un solo caso abierto por reserva y motivo (evita duplicados por doble pulsación).
create unique index if not exists incidencias_pago_abierta_unica
  on public.incidencias_pago (reserva_id, tipo)
  where estado in ('abierta', 'en_revision');

create table if not exists public.incidencias_pago_eventos (
  id             uuid primary key default gen_random_uuid(),
  incidencia_id  uuid not null references public.incidencias_pago(id) on delete cascade,
  estado         text not null,
  respuesta      text,
  created_at     timestamptz not null default now()
);
create index if not exists incidencias_pago_eventos_idx on public.incidencias_pago_eventos (incidencia_id, created_at);

drop trigger if exists trg_incidencias_pago_updated on public.incidencias_pago;
create trigger trg_incidencias_pago_updated
  before update on public.incidencias_pago
  for each row execute function public.pagos_tocar_updated_at();

-- Cuenta eliminada: se borra el texto libre (puede contener datos personales).
create or replace function public.incidencias_pago_anonimizar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.usuario_id is not null and new.usuario_id is null then
    new.descripcion := '(texto eliminado: cuenta borrada)';
    new.respuesta := null;
    delete from public.incidencias_pago_eventos where incidencia_id = new.id and respuesta is not null;
  end if;
  return new;
end;
$$;
revoke all on function public.incidencias_pago_anonimizar() from public, anon, authenticated;

drop trigger if exists trg_incidencias_pago_anonimizar on public.incidencias_pago;
create trigger trg_incidencias_pago_anonimizar
  before update of usuario_id on public.incidencias_pago
  for each row execute function public.incidencias_pago_anonimizar();

-- Permisos: cada persona LEE lo suyo; todo se escribe con las funciones de abajo.
alter table public.incidencias_pago enable row level security;
revoke all on public.incidencias_pago from anon, authenticated;
grant select on public.incidencias_pago to authenticated;
drop policy if exists "ver mis incidencias" on public.incidencias_pago;
create policy "ver mis incidencias" on public.incidencias_pago
  for select to authenticated using (usuario_id = auth.uid());

alter table public.incidencias_pago_eventos enable row level security;
revoke all on public.incidencias_pago_eventos from anon, authenticated;
grant select on public.incidencias_pago_eventos to authenticated;
drop policy if exists "ver eventos de mis incidencias" on public.incidencias_pago_eventos;
create policy "ver eventos de mis incidencias" on public.incidencias_pago_eventos
  for select to authenticated using (
    exists (select 1 from public.incidencias_pago i where i.id = incidencia_id and i.usuario_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Reservas sobre las que se puede reclamar (incluye canceladas). SECURITY DEFINER para poder mostrar el
-- título aunque la sesión ya no sea visible (p. ej. bloqueo, sql/086); no devuelve nada del organizador.
-- ----------------------------------------------------------------------------
create or replace function public.mis_reservas_reclamables()
returns table (reserva_id uuid, titulo text, fecha date, hora time, estado_reserva text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, c.titulo::text, c.fecha, c.hora, r.estado::text
    from public.reservas r
    join public.clases c on c.id = r.clase_id
   where r.cliente_id = auth.uid()
   order by r.created_at desc
   limit 100
$$;
revoke all on function public.mis_reservas_reclamables() from public, anon;
grant execute on function public.mis_reservas_reclamables() to authenticated;

-- ----------------------------------------------------------------------------
-- Abrir un caso
-- ----------------------------------------------------------------------------
create or replace function public.abrir_incidencia(p_reserva_id uuid, p_tipo text, p_descripcion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_reserva record;
  v_cobro   uuid;
  v_texto   text := btrim(coalesce(p_descripcion, ''));
  v_numero  text;
  v_id      uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_tipo is null or p_tipo not in ('cobro', 'cancelacion', 'reembolso') then
    raise exception 'Motivo no válido.' using errcode = 'P0001';
  end if;
  if char_length(v_texto) < 10 or char_length(v_texto) > 1000 then
    raise exception 'Explica lo ocurrido con entre 10 y 1000 caracteres.' using errcode = 'P0001';
  end if;

  -- Serializa las aperturas de la misma persona: los límites no se pueden saltar con envíos simultáneos.
  perform pg_advisory_xact_lock(hashtext('incidencia:' || v_usuario::text));

  select r.id, r.clase_id, c.titulo, c.fecha
    into v_reserva
    from public.reservas r
    join public.clases c on c.id = r.clase_id
   where r.id = p_reserva_id and r.cliente_id = v_usuario;
  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.incidencias_pago
     where reserva_id = p_reserva_id and tipo = p_tipo and estado in ('abierta', 'en_revision')
  ) then
    raise exception 'Ya tienes un caso abierto por este motivo para esta reserva.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.incidencias_pago
       where usuario_id = v_usuario and estado in ('abierta', 'en_revision')) >= 10
     or (select count(*) from public.incidencias_pago
          where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Has abierto muchos casos seguidos. Espera a que revisemos los anteriores.' using errcode = 'P0001';
  end if;

  -- Cobro relacionado: el de la reserva o, si el pago no llegó a dar plaza, el último de esa sesión.
  select id into v_cobro
    from public.cobros
   where cliente_id = v_usuario
     and (reserva_id = p_reserva_id or (reserva_id is null and clase_id = v_reserva.clase_id))
     and estado <> 'creado'
   order by (reserva_id = p_reserva_id) desc nulls last, created_at desc
   limit 1;

  v_numero := 'RF-' || to_char(now() at time zone 'Europe/Madrid', 'YYYY') || '-'
              || lpad(nextval('public.incidencias_pago_numero_seq')::text, 6, '0');

  insert into public.incidencias_pago (numero, usuario_id, reserva_id, cobro_id, clase_titulo, clase_fecha, tipo, descripcion)
  values (v_numero, v_usuario, p_reserva_id, v_cobro, v_reserva.titulo, v_reserva.fecha, p_tipo, v_texto)
  returning id into v_id;

  insert into public.incidencias_pago_eventos (incidencia_id, estado) values (v_id, 'abierta');

  -- Aviso de recibo (campana). Un fallo aquí nunca impide registrar el caso.
  begin
    perform public.generar_notificacion(v_usuario, 'incidencia_pago', 'Hemos recibido tu reclamación',
      'Caso ' || v_numero || ': lo revisaremos y verás aquí su estado.', '/mis-reservas?pestana=reclamaciones');
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero);
end;
$$;
revoke all on function public.abrir_incidencia(uuid, text, text) from public, anon;
grant execute on function public.abrir_incidencia(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Cambiar estado y responder (solo servicio). No toca cobros: una devolución se tramita por su propio cauce.
-- ----------------------------------------------------------------------------
create or replace function public.actualizar_incidencia(p_id uuid, p_estado text, p_respuesta text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caso  public.incidencias_pago%rowtype;
  v_resp  text := nullif(btrim(coalesce(p_respuesta, '')), '');
begin
  if p_estado is null or p_estado not in ('abierta', 'en_revision', 'resuelta', 'rechazada') then
    raise exception 'Estado no válido.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(v_resp, '')) > 1000 then
    raise exception 'La respuesta admite como máximo 1000 caracteres.' using errcode = 'P0001';
  end if;
  select * into v_caso from public.incidencias_pago where id = p_id for update;
  if not found then
    raise exception 'El caso no existe.' using errcode = 'P0002';
  end if;
  if p_estado in ('resuelta', 'rechazada') and v_resp is null and v_caso.respuesta is null then
    raise exception 'Para cerrar un caso hay que escribir una respuesta.' using errcode = 'P0001';
  end if;
  if p_estado = v_caso.estado and (v_resp is null or v_resp = v_caso.respuesta) then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;

  update public.incidencias_pago
     set estado = p_estado,
         respuesta = coalesce(v_resp, respuesta),
         cerrada_en = case when p_estado in ('resuelta', 'rechazada') then now() else null end
   where id = p_id;
  insert into public.incidencias_pago_eventos (incidencia_id, estado, respuesta) values (p_id, p_estado, v_resp);

  if v_caso.usuario_id is not null then
    begin
      perform public.generar_notificacion(v_caso.usuario_id, 'incidencia_pago', 'Novedades en tu reclamación',
        'El caso ' || v_caso.numero || ' tiene una actualización.', '/mis-reservas?pestana=reclamaciones');
    exception when others then null; end;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.actualizar_incidencia(uuid, text, text) from public, anon, authenticated;
grant execute on function public.actualizar_incidencia(uuid, text, text) to service_role;
