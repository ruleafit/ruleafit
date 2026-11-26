-- ============================================================================
-- Ruleafit · 100_reprogramaciones.sql
-- Pendiente 38: reprogramaciones importantes (fecha, hora o ubicación) con aceptación y salida sin coste.
-- Requiere sql/071-072 y sql/087. No activa pagos ni mueve dinero.
--
-- REGLAS (todas en el servidor):
--  · Solo quien organiza, sobre UNA sesión activa. Con reservas activas, el cambio exige 24 h de antelación
--    respecto al horario anterior Y al nuevo; sin reservas, 2 h (como editar_clase). Máx. 3 cambios por sesión.
--  · Cada participante con reserva recibe un aviso y queda 'pendiente': puede ACEPTAR o CANCELAR SIN COSTE.
--  · No responder NO es aceptar: puede cancelar sin coste hasta que empiece la sesión.
--  · Salir por reprogramación: la plaza se libera, la sesión del bono vuelve y un cobro 'pagado' sin liberar pasa
--    a 'requiere_reembolso' (la devolución real sigue su proceso: sql/096). Nunca se marca 'reembolsado' aquí.
--  · cancelar_reserva(): igual que en sql/087 salvo que con un cambio pendiente de respuesta la cancelación nunca
--    es tardía. La web muestra lo mismo (lib/reprogramacion.js).
--  · Un pago iniciado antes del cambio y confirmado después también queda pendiente de respuesta.
--
-- editar_serie (sql/094) no cambia: por esa vía las sesiones con reservas siguen sin moverse.
-- Reversión: sql/100_reprogramaciones_reversion.sql
-- ============================================================================

create table if not exists public.reprogramaciones (
  id         uuid primary key default gen_random_uuid(),
  clase_id   uuid not null references public.clases(id) on delete cascade,
  antes      jsonb not null,
  despues    jsonb not null,
  motivo     text check (char_length(motivo) <= 300),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists reprogramaciones_clase_idx on public.reprogramaciones (clase_id, created_at desc);

create table if not exists public.reprogramacion_respuestas (
  id                uuid primary key default gen_random_uuid(),
  reprogramacion_id uuid not null references public.reprogramaciones(id) on delete cascade,
  reserva_id        uuid not null references public.reservas(id) on delete cascade,
  usuario_id        uuid not null references auth.users(id) on delete cascade,
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente', 'aceptada', 'cancelada', 'sustituida')),
  respondida_en     timestamptz,
  unique (reprogramacion_id, reserva_id)
);
create unique index if not exists reprogramacion_pendiente_unica
  on public.reprogramacion_respuestas (reserva_id) where estado = 'pendiente';

-- Sin acceso directo de nadie: todo pasa por las funciones.
alter table public.reprogramaciones enable row level security;
alter table public.reprogramacion_respuestas enable row level security;
revoke all on public.reprogramaciones from anon, authenticated;
revoke all on public.reprogramacion_respuestas from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Reprogramar (organizador). p_campos: { fecha?, hora?, ubicacion?: { lat, lng, ciudad, provincia, direccion }, motivo? }
-- ----------------------------------------------------------------------------
create or replace function public.reprogramar_sesion(p_clase_id uuid, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario  uuid := auth.uid();
  v_c        public.clases%rowtype;
  v_ahora    timestamp := (now() at time zone 'Europe/Madrid');
  v_fecha    date;
  v_hora     time;
  v_lat      double precision;
  v_lng      double precision;
  v_ciudad   text;
  v_prov     text;
  v_dir      text;
  v_u        jsonb;
  v_motivo   text := nullif(btrim(coalesce(p_campos ->> 'motivo', '')), '');
  v_reservas integer;
  v_margen   interval;
  v_cuando   boolean;
  v_donde    boolean;
  v_id       uuid;
  v_antes    jsonb;
  v_despues  jsonb;
  r          record;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  -- Bloquea la sesión: reservar_clase y confirmar_cobro_pagado bloquean la misma fila, así que no se cuela nadie.
  select * into v_c from public.clases where id = p_clase_id for update;
  if not found then
    raise exception 'La sesión no existe.' using errcode = 'P0002';
  end if;
  if v_c.trainer_id <> v_usuario then
    raise exception 'Solo puedes reprogramar tus propias sesiones.' using errcode = '42501';
  end if;
  if v_c.estado <> 'activa' then
    raise exception 'No se puede reprogramar una sesión cancelada.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(v_motivo, '')) > 300 then
    raise exception 'El motivo admite como máximo 300 caracteres.' using errcode = 'P0001';
  end if;

  v_fecha := coalesce(nullif(p_campos ->> 'fecha', '')::date, v_c.fecha);
  v_hora  := coalesce(nullif(p_campos ->> 'hora', '')::time, v_c.hora);
  v_lat := v_c.lat; v_lng := v_c.lng; v_ciudad := v_c.ciudad; v_prov := v_c.provincia; v_dir := v_c.direccion;

  if p_campos ? 'ubicacion' then
    v_u := p_campos -> 'ubicacion';
    if jsonb_typeof(v_u) is distinct from 'object'
       or jsonb_typeof(v_u -> 'lat') is distinct from 'number'
       or jsonb_typeof(v_u -> 'lng') is distinct from 'number' then
      raise exception 'La ubicación debe incluir las coordenadas del mapa.' using errcode = 'P0001';
    end if;
    v_lat := (v_u ->> 'lat')::double precision;
    v_lng := (v_u ->> 'lng')::double precision;
    if v_lat < 27 or v_lat > 44.5 or v_lng < -19 or v_lng > 5.5 then
      raise exception 'La ubicación debe estar en España.' using errcode = 'P0001';
    end if;
    v_ciudad := nullif(btrim(coalesce(v_u ->> 'ciudad', '')), '');
    if v_ciudad is null then
      raise exception 'Falta el municipio de la ubicación.' using errcode = 'P0001';
    end if;
    v_prov := nullif(btrim(coalesce(v_u ->> 'provincia', '')), '');
    v_dir  := nullif(btrim(coalesce(v_u ->> 'direccion', '')), '');
    if char_length(v_ciudad) > 100 or char_length(coalesce(v_prov, '')) > 100 or char_length(coalesce(v_dir, '')) > 300 then
      raise exception 'La ubicación tiene datos demasiado largos.' using errcode = 'P0001';
    end if;
  end if;

  v_cuando := v_fecha is distinct from v_c.fecha or v_hora is distinct from v_c.hora;
  v_donde  := v_lat is distinct from v_c.lat or v_lng is distinct from v_c.lng
              or v_ciudad is distinct from v_c.ciudad or v_dir is distinct from v_c.direccion;
  if not v_cuando and not v_donde then
    raise exception 'No hay ningún cambio de fecha, hora o ubicación.' using errcode = 'P0001';
  end if;

  select count(*) into v_reservas from public.reservas where clase_id = p_clase_id and estado = 'activa';
  v_margen := case when v_reservas > 0 then interval '24 hours' else interval '2 hours' end;
  if (v_c.fecha + v_c.hora) - v_ahora < v_margen or (v_fecha + v_hora) - v_ahora < v_margen then
    if v_reservas > 0 then
      raise exception 'Con reservas, solo se puede reprogramar con al menos 24 horas de antelación (sobre el horario anterior y el nuevo). Si no puedes celebrarla, cancélala.'
        using errcode = 'P0001';
    end if;
    raise exception 'Solo se puede reprogramar con al menos 2 horas de antelación.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reprogramaciones where clase_id = p_clase_id) >= 3 then
    raise exception 'Esta sesión ya se ha reprogramado 3 veces. Cancélala y publica una nueva.' using errcode = 'P0001';
  end if;
  if v_cuando and exists (
    select 1 from public.clases o
     where o.trainer_id = v_usuario and o.id <> p_clase_id and o.estado = 'activa' and o.fecha = v_fecha
       and (o.hora = v_hora
            or (v_c.serie_id is not null and o.serie_id = v_c.serie_id
                and (v_fecha + o.hora) < (v_fecha + v_hora) + make_interval(mins => coalesce(v_c.duracion, 60))
                and (v_fecha + v_hora) < (v_fecha + o.hora) + make_interval(mins => coalesce(o.duracion, 60))))
  ) then
    raise exception 'Ya tienes otra sesión que coincide con ese horario.' using errcode = 'P0001';
  end if;

  v_antes := jsonb_build_object('fecha', v_c.fecha, 'hora', v_c.hora, 'ciudad', v_c.ciudad, 'provincia', v_c.provincia,
                                'direccion', v_c.direccion, 'lat', v_c.lat, 'lng', v_c.lng);
  v_despues := jsonb_build_object('fecha', v_fecha, 'hora', v_hora, 'ciudad', v_ciudad, 'provincia', v_prov,
                                  'direccion', v_dir, 'lat', v_lat, 'lng', v_lng);

  update public.clases
     set fecha = v_fecha, hora = v_hora, lat = v_lat, lng = v_lng, ciudad = v_ciudad, provincia = v_prov, direccion = v_dir
   where id = p_clase_id;

  -- Los recordatorios ya enviados eran del horario antiguo.
  if v_cuando then
    delete from public.recordatorios_enviados where clase_id = p_clase_id;
  end if;

  insert into public.reprogramaciones (clase_id, antes, despues, motivo)
  values (p_clase_id, v_antes, v_despues, v_motivo)
  returning id into v_id;

  for r in select id, cliente_id from public.reservas where clase_id = p_clase_id and estado = 'activa' order by id loop
    update public.reprogramacion_respuestas set estado = 'sustituida' where reserva_id = r.id and estado = 'pendiente';
    insert into public.reprogramacion_respuestas (reprogramacion_id, reserva_id, usuario_id)
    values (v_id, r.id, r.cliente_id);
    perform public.generar_notificacion(r.cliente_id, 'sesion_reprogramada', 'Ha cambiado una sesión que reservaste',
      format('«%s» ahora es el %s a las %s en %s. Acéptalo o cancela sin coste.', v_c.titulo,
             to_char(v_fecha, 'DD/MM/YYYY'), to_char(v_hora, 'HH24:MI'), v_ciudad),
      '/mis-reservas');
  end loop;

  return jsonb_build_object('ok', true, 'reprogramacion_id', v_id, 'avisados', v_reservas);
end;
$$;
revoke all on function public.reprogramar_sesion(uuid, jsonb) from public, anon;
grant execute on function public.reprogramar_sesion(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Mis cambios pendientes de respuesta
-- ----------------------------------------------------------------------------
create or replace function public.mis_reprogramaciones_pendientes()
returns table (respuesta_id uuid, reserva_id uuid, clase_id uuid, antes jsonb, despues jsonb, motivo text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select x.id, x.reserva_id, p.clase_id, p.antes, p.despues, p.motivo, p.created_at
    from public.reprogramacion_respuestas x
    join public.reprogramaciones p on p.id = x.reprogramacion_id
    join public.reservas r on r.id = x.reserva_id and r.estado = 'activa'
    join public.clases c on c.id = p.clase_id and c.estado = 'activa'
   where x.usuario_id = auth.uid() and x.estado = 'pendiente'
     and (c.fecha + c.hora) >= (now() at time zone 'Europe/Madrid')
$$;
revoke all on function public.mis_reprogramaciones_pendientes() from public, anon;
grant execute on function public.mis_reprogramaciones_pendientes() to authenticated;

-- ----------------------------------------------------------------------------
-- Responder: aceptar, o cancelar sin coste
-- ----------------------------------------------------------------------------
create or replace function public.responder_reprogramacion(p_respuesta_id uuid, p_aceptar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario   uuid := auth.uid();
  v_resp      public.reprogramacion_respuestas%rowtype;
  v_reserva   record;
  v_clase     record;
  v_cobro     uuid;
  v_reembolso text;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_aceptar is null then
    raise exception 'Respuesta no válida.' using errcode = 'P0001';
  end if;
  select * into v_resp from public.reprogramacion_respuestas where id = p_respuesta_id and usuario_id = v_usuario;
  if not found then
    raise exception 'El cambio no existe.' using errcode = 'P0002';
  end if;

  -- Mismo orden de bloqueo que cancelar_reserva: reserva y después sesión.
  select id, clase_id, estado, bono_cliente_id into v_reserva
    from public.reservas where id = v_resp.reserva_id for no key update;
  select id, trainer_id, titulo, estado, fecha, hora into v_clase
    from public.clases where id = v_reserva.clase_id for update;
  select * into v_resp from public.reprogramacion_respuestas where id = p_respuesta_id for update;

  if v_resp.estado = 'sustituida' then
    raise exception 'La sesión ha vuelto a cambiar. Recarga la página y revisa el cambio más reciente.' using errcode = 'P0001';
  end if;
  if v_resp.estado <> 'pendiente' then
    raise exception 'Ya habías respondido a este cambio.' using errcode = 'P0001';
  end if;
  if v_reserva.estado <> 'activa' or v_clase.estado <> 'activa' then
    raise exception 'Esta reserva ya está cancelada.' using errcode = 'P0001';
  end if;
  if (v_clase.fecha + v_clase.hora) < (now() at time zone 'Europe/Madrid') then
    raise exception 'La sesión ya ha empezado.' using errcode = 'P0001';
  end if;

  update public.reprogramacion_respuestas
     set estado = case when p_aceptar then 'aceptada' else 'cancelada' end, respondida_en = now()
   where id = p_respuesta_id;

  if p_aceptar then
    return jsonb_build_object('ok', true, 'resultado', 'aceptada');
  end if;

  update public.reservas
     set estado = 'cancelada', cancelled_at = now(), cancelacion_tardia = false
   where id = v_reserva.id;
  update public.clases set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0) where id = v_clase.id;

  select id into v_cobro from public.cobros
   where reserva_id = v_reserva.id and estado = 'pagado' and liberado_en is null
   order by created_at desc limit 1 for update;
  if v_cobro is not null then
    update public.cobros set estado = 'requiere_reembolso' where id = v_cobro;
    v_reembolso := 'pendiente';
  end if;

  perform public.generar_notificacion(v_clase.trainer_id, 'reprogramacion_baja', 'Una reserva menos tras el cambio',
    format('Alguien ha cancelado su plaza en «%s» por la reprogramación.', v_clase.titulo), '/mis-clases');

  return jsonb_build_object('ok', true, 'resultado', 'cancelada', 'usaba_bono', v_reserva.bono_cliente_id is not null,
                            'reembolso', v_reembolso);
end;
$$;
revoke all on function public.responder_reprogramacion(uuid, boolean) from public, anon;
grant execute on function public.responder_reprogramacion(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Pago iniciado antes del cambio y confirmado después: la nueva reserva también tiene que poder decidir.
-- Blindado: un fallo aquí nunca impide una reserva.
-- ----------------------------------------------------------------------------
create or replace function public.reprogramacion_tras_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rep uuid;
begin
  begin
    select p.id into v_rep
      from public.reprogramaciones p
     where p.clase_id = new.clase_id
       and exists (select 1 from public.cobros co
                    where co.clase_id = new.clase_id and co.cliente_id = new.cliente_id
                      and co.estado = 'creado' and co.created_at < p.created_at)
     order by p.created_at desc
     limit 1;
    if v_rep is not null then
      insert into public.reprogramacion_respuestas (reprogramacion_id, reserva_id, usuario_id)
      values (v_rep, new.id, new.cliente_id);
      perform public.generar_notificacion(new.cliente_id, 'sesion_reprogramada', 'La sesión cambió mientras pagabas',
        'Revisa la nueva fecha o ubicación: puedes aceptarla o cancelar sin coste.', '/mis-reservas');
    end if;
  exception when others then
    raise warning 'reprogramacion_tras_pago: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.reprogramacion_tras_pago() from public, anon, authenticated;
drop trigger if exists trg_reprogramacion_tras_pago on public.reservas;
create trigger trg_reprogramacion_tras_pago
  after insert on public.reservas
  for each row execute function public.reprogramacion_tras_pago();

-- ----------------------------------------------------------------------------
-- cancelar_reserva: sql/087 + «con un cambio pendiente de respuesta no es tardía»
-- ----------------------------------------------------------------------------
create or replace function public.cancelar_reserva(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id          uuid;
  v_reserva              record;
  v_clase                record;
  v_clase_inicio         timestamp;
  v_ahora_local          timestamp;
  v_tardia               boolean;
  v_cobro                uuid;
  v_reembolso            text;
  v_plazas_ocupadas      integer;
  v_cambio               uuid;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar.' using errcode = '28000';
  end if;

  -- 2. La reserva debe existir (bloqueada: dos cancelaciones simultáneas se serializan).
  select id, clase_id, cliente_id, estado, bono_cliente_id
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  -- 3. Debe ser del usuario autenticado.
  if v_reserva.cliente_id <> v_usuario_id then
    raise exception 'No puedes cancelar una reserva que no es tuya.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_reserva.estado <> 'activa' then
    raise exception 'Esta reserva ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. La clase debe existir (se bloquea porque se decrementa plazas_ocupadas).
  select id, estado, fecha, hora, plazas_ocupadas
    into v_clase
    from public.clases
    where id = v_reserva.clase_id
    for update;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  -- 6. Solo antes de que empiece (hora local de España, igual que reservar_clase).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 7. Con menos de 2 h la cancelación es tardía... salvo que haya un cambio de la sesión sin responder (sql/100).
  select id into v_cambio
    from public.reprogramacion_respuestas
    where reserva_id = p_reserva_id and estado = 'pendiente'
    for update;
  v_tardia := v_cambio is null and (v_clase_inicio - v_ahora_local) < interval '2 hours';
  if v_cambio is not null then
    update public.reprogramacion_respuestas set estado = 'cancelada', respondida_en = now() where id = v_cambio;
  end if;

  -- 8. Cancelar la reserva y dejar constancia de si fue tardía.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now(),
        cancelacion_tardia = v_tardia
    where id = p_reserva_id;

  -- 9. Liberar la plaza (sin bajar nunca de 0).
  update public.clases
    set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0)
    where id = v_reserva.clase_id
    returning plazas_ocupadas into v_plazas_ocupadas;

  -- 10. Cobro de esta reserva (solo si hubo pago real y no estaba ya liberado/gestionado).
  --     a tiempo → 'requiere_reembolso'; tardía → se queda 'pagado'. Nunca se marca 'reembolsado'.
  select id
    into v_cobro
    from public.cobros
    where reserva_id = p_reserva_id
      and estado = 'pagado'
      and liberado_en is null
    order by created_at desc
    limit 1
    for update;

  if v_cobro is not null then
    if v_tardia then
      v_reembolso := 'sin_derecho';
    else
      update public.cobros set estado = 'requiere_reembolso' where id = v_cobro;
      v_reembolso := 'pendiente';
    end if;
  end if;

  -- 11. Resultado (mismo formato que en sql/087).
  return jsonb_build_object(
    'ok', true,
    'clase_id', v_reserva.clase_id,
    'plazas_ocupadas', v_plazas_ocupadas,
    'reembolso_aplicable', not v_tardia,
    'cancelacion_tardia', v_tardia,
    'usaba_bono', v_reserva.bono_cliente_id is not null,
    'reembolso', v_reembolso
  );
end;
$$;

revoke all on function public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.cancelar_reserva(uuid) to authenticated;
