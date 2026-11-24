-- ============================================================================
-- Ruleafit · 092_avisos_plaza.sql
-- C15 · «Avísame si queda una plaza».
--
-- DISEÑO
--  · alertas_plaza: interés de un usuario en UNA sesión concreta (única por usuario+sesión). Solo se escribe con
--    activar_aviso_plaza / desactivar_aviso_plaza (el usuario sale de auth.uid(), nunca del cliente).
--  · DETECCIÓN: un CONSTRAINT TRIGGER diferido (se ejecuta al confirmar la transacción) sobre clases detecta la
--    transición real COMPLETA → CON PLAZAS (plazas_ocupadas >= plazas_max antes, < después) con la sesión
--    activa y sin empezar. Al ser diferido ve el estado FINAL: si la misma operación cancela la sesión entera
--    (cancelar_clase, autocancelación) no se avisa. Cubre TODOS los caminos que cambian la ocupación
--    (cancelar_reserva, cancelaciones por bloqueo, eliminar cuenta, cambios de capacidad en editar_clase…)
--    sin tocar ninguna de esas funciones.
--  · EPISODIOS: cada transición completa→disponible abre un episodio (episodios_plaza) EN LA MISMA transacción
--    que el cambio: si el cambio se confirma, el evento existe; si falla, no hay evento. Un episodio por
--    transición: mientras siga habiendo plazas no se abre otro (9/10→8/10 no repite el aviso); si se vuelve a
--    completar y luego se libera otra, se abre uno nuevo.
--  · AVISO A TODOS A LA VEZ: procesar_episodio_plaza() se ejecuta en el mismo commit y crea la notificación
--    (campana + cola push) de TODOS los interesados elegibles en una sola ronda, sin turnos ni prioridad.
--    avisos_plaza_enviados (episodio, usuario) garantiza idempotencia: un reintento nunca duplica.
--  · FIABILIDAD: si el procesamiento inmediato falla, el episodio queda pendiente/error y lo recupera
--    procesar_episodios_plaza_pendientes() (cron, ver 092_avisos_plaza_cron.sql). Antes de enviar se REVALIDA
--    (activa, sin empezar, con plaza libre).
--  · PUSH RÁPIDO: empujar_cola_notificaciones() lanza al instante el procesador de la cola existente.
--  · Antiabuso: un aviso por episodio y usuario; no se repite una ronda en menos de 60 s para la misma sesión;
--    máx. 6 rondas por sesión y hora; máx. 30 alertas activas por usuario.
--  · No toca reservas, bonos, cobros ni pagos. Solo se modifica generar_notificacion para añadir el tipo
--    'plaza_libre' (categoría desactivable 'avisos_plazas').
--
-- Reversión: sql/092_avisos_plaza_reversion.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.alertas_plaza (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  clase_id    uuid not null references public.clases(id) on delete cascade,
  estado      text not null default 'activa' check (estado in ('activa', 'desactivada')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (usuario_id, clase_id)
);
create index if not exists alertas_plaza_clase_activas_idx on public.alertas_plaza (clase_id) where estado = 'activa';
create index if not exists alertas_plaza_usuario_idx on public.alertas_plaza (usuario_id, estado);

create table if not exists public.episodios_plaza (
  id            uuid primary key default gen_random_uuid(),
  clase_id      uuid not null references public.clases(id) on delete cascade,
  tx_id         bigint not null,                      -- una transacción abre como mucho un episodio por sesión
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'procesado', 'descartado', 'omitido', 'error', 'fallido')),
  intentos      integer not null default 0,
  notificados   integer not null default 0,
  motivo        text,
  created_at    timestamptz not null default now(),
  procesado_at  timestamptz,
  unique (clase_id, tx_id)
);
create index if not exists episodios_plaza_pendientes_idx on public.episodios_plaza (created_at) where estado in ('pendiente', 'error');
create index if not exists episodios_plaza_clase_idx on public.episodios_plaza (clase_id, created_at desc);

create table if not exists public.avisos_plaza_enviados (
  episodio_id uuid not null references public.episodios_plaza(id) on delete cascade,
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (episodio_id, usuario_id)
);

-- Privacidad: nadie ve los interesados de otra persona. episodios y enviados son internos (sin acceso de cliente).
alter table public.alertas_plaza enable row level security;
alter table public.episodios_plaza enable row level security;
alter table public.avisos_plaza_enviados enable row level security;
revoke all on public.alertas_plaza from anon, authenticated;
revoke all on public.episodios_plaza from anon, authenticated;
revoke all on public.avisos_plaza_enviados from anon, authenticated;

drop policy if exists "Ver mis alertas de plaza" on public.alertas_plaza;
create policy "Ver mis alertas de plaza" on public.alertas_plaza for select to authenticated using (usuario_id = auth.uid());
grant select on public.alertas_plaza to authenticated; -- solo lectura de lo propio; escribir = solo por RPC

-- ---------------------------------------------------------------------------
-- 2. generar_notificacion: añade el tipo 'plaza_libre' (categoría desactivable 'avisos_plazas').
--    ÚNICO cambio respecto a la versión vigente: la rama 'plaza_libre'.
-- ---------------------------------------------------------------------------
create or replace function public.generar_notificacion(
  p_usuario_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_cuerpo     text,
  p_url        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text;
  v_critica   boolean := false;
  v_activa    boolean;
begin
  case p_tipo
    when 'sesion_publicada' then
      v_categoria := 'publicaciones';
    when 'recordatorio_sesion_24h' then
      v_categoria := 'recordatorio_24h';
    when 'recordatorio_sesion_7h' then
      v_categoria := 'recordatorio_7h';
    when 'recordatorio_sesion_2h' then
      v_categoria := 'recordatorio_2h';
    when 'recordatorio_sesion_24h_entrenador' then
      v_categoria := 'recordatorio_24h_entrenador';
    when 'recordatorio_sesion_7h_entrenador' then
      v_categoria := 'recordatorio_7h_entrenador';
    when 'recordatorio_sesion_2h_entrenador' then
      v_categoria := 'recordatorio_2h_entrenador';
    when 'recordatorio_sesion_10min_entrenador' then
      v_categoria := 'recordatorio_10min_entrenador';
    when 'plazas_agotadas' then
      v_categoria := 'plazas_agotadas';
    when 'solicitud_valoracion' then
      v_categoria := 'solicitud_valoracion';
    when 'aviso_organizador' then
      v_categoria := 'avisos_organizador';
    when 'plaza_libre' then
      v_categoria := 'avisos_plazas';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      v_categoria := 'otras';
      v_critica := true;
  end case;

  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Utilidades internas
-- ---------------------------------------------------------------------------
-- Misma regla que reservar_clase: empezada = inicio (hora de Madrid) anterior a ahora.
create or replace function public.sesion_ya_empezo(p_fecha date, p_hora time)
returns boolean
language sql
stable
set search_path = public
as $$
  select (p_fecha + p_hora) < (now() at time zone 'Europe/Madrid')
$$;

-- Lanza de inmediato el procesador de la cola push ya existente reutilizando la orden del cron
-- 'procesar-notificaciones' (la clave sigue solo en cron.job, nunca se lee ni se muestra aquí). Si algo falla o no
-- existe (p. ej. entorno de pruebas), no pasa nada: el cron de la cola lo recogerá igualmente.
create or replace function public.empujar_cola_notificaciones()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_orden text;
begin
  begin
    select command into v_orden from cron.job where jobname = 'procesar-notificaciones' limit 1;
    if v_orden is not null then
      execute v_orden;
    end if;
  exception when others then
    null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC de usuario
-- ---------------------------------------------------------------------------
create or replace function public.activar_aviso_plaza(p_clase_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_clase  record;
  v_activas integer;
  v_ya     boolean;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para activar el aviso.' using errcode = '28000';
  end if;

  -- Bloqueo compartido: no se activa a la vez que cambia la ocupación.
  select id, trainer_id, estado, fecha, hora, plazas_max, plazas_ocupadas
    into v_clase
    from public.clases
   where id = p_clase_id
   for share;

  if not found
     or exists (select 1 from public.bloqueos b where b.bloqueador_id = v_clase.trainer_id and b.bloqueado_id = v_uid) then
    raise exception 'La sesión no existe.' using errcode = 'P0002';
  end if;
  if v_clase.trainer_id = v_uid then
    raise exception 'No puedes activar avisos en tu propia sesión.' using errcode = '42501';
  end if;
  if v_clase.estado <> 'activa' then
    raise exception 'Esta sesión ya no está activa.' using errcode = 'P0001';
  end if;
  if public.sesion_ya_empezo(v_clase.fecha, v_clase.hora) then
    raise exception 'Esta sesión ya ha empezado.' using errcode = 'P0001';
  end if;
  if v_clase.plazas_ocupadas < v_clase.plazas_max then
    raise exception 'Esta sesión tiene plazas libres: puedes reservar directamente.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reservas r where r.clase_id = p_clase_id and r.cliente_id = v_uid and r.estado = 'activa') then
    raise exception 'Ya tienes una reserva activa para esta sesión.' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.alertas_plaza where usuario_id = v_uid and clase_id = p_clase_id and estado = 'activa')
    into v_ya;
  if v_ya then
    return jsonb_build_object('ok', true, 'activo', true, 'ya_activo', true); -- sin duplicar
  end if;

  select count(*) into v_activas from public.alertas_plaza where usuario_id = v_uid and estado = 'activa';
  if v_activas >= 30 then
    raise exception 'Has alcanzado el máximo de 30 avisos activos. Desactiva alguno para añadir más.' using errcode = 'P0001';
  end if;

  insert into public.alertas_plaza (usuario_id, clase_id, estado)
  values (v_uid, p_clase_id, 'activa')
  on conflict (usuario_id, clase_id) do update set estado = 'activa', updated_at = now();

  return jsonb_build_object('ok', true, 'activo', true, 'ya_activo', false);
end;
$$;

create or replace function public.desactivar_aviso_plaza(p_clase_id uuid)
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
  update public.alertas_plaza
     set estado = 'desactivada', updated_at = now()
   where usuario_id = v_uid and clase_id = p_clase_id and estado = 'activa';
  return jsonb_build_object('ok', true, 'activo', false);
end;
$$;

-- Avisos activos del usuario sobre sesiones vigentes (activas y sin empezar).
create or replace function public.mis_avisos_plaza()
returns table (
  clase_id     uuid,
  titulo       text,
  fecha        date,
  hora         time,
  ciudad       text,
  organizador  text,
  hay_plaza    boolean,
  activado_en  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.titulo, c.fecha, c.hora, c.ciudad, p.username,
         c.plazas_ocupadas < c.plazas_max,
         a.created_at
    from public.alertas_plaza a
    join public.clases c on c.id = a.clase_id
    left join public.perfiles p on p.id = c.trainer_id
   where a.usuario_id = auth.uid()
     and a.estado = 'activa'
     and c.estado = 'activa'
     and not public.sesion_ya_empezo(c.fecha, c.hora)
     and not exists (select 1 from public.bloqueos b where b.bloqueador_id = c.trainer_id and b.bloqueado_id = auth.uid())
   order by c.fecha, c.hora
$$;

-- ---------------------------------------------------------------------------
-- 5. Reservar desactiva el aviso del propio usuario
-- ---------------------------------------------------------------------------
create or replace function public.desactivar_aviso_al_reservar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Blindado: un fallo aquí NUNCA debe impedir una reserva.
  begin
    if new.estado = 'activa' then
      update public.alertas_plaza
         set estado = 'desactivada', updated_at = now()
       where usuario_id = new.cliente_id and clase_id = new.clase_id and estado = 'activa';
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists trg_desactivar_aviso_al_reservar on public.reservas;
create trigger trg_desactivar_aviso_al_reservar
  after insert on public.reservas
  for each row execute function public.desactivar_aviso_al_reservar();

-- ---------------------------------------------------------------------------
-- 6. Procesamiento de un episodio (aviso a TODOS a la vez, idempotente)
-- ---------------------------------------------------------------------------
create or replace function public.procesar_episodio_plaza(p_episodio uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ep        record;
  v_clase     record;
  v_usuario   uuid;
  v_nuevos    integer := 0;
  v_fallos    integer := 0;
  v_dia       text;
  v_cuerpo    text;
  v_hoy       date := (now() at time zone 'Europe/Madrid')::date;
  v_rondas    integer;
begin
  select * into v_ep from public.episodios_plaza where id = p_episodio for update;
  if not found or v_ep.estado not in ('pendiente', 'error') then
    return 0;
  end if;

  select id, trainer_id, titulo, estado, fecha, hora, plazas_max, plazas_ocupadas
    into v_clase from public.clases where id = v_ep.clase_id;

  -- Revalidación con datos reales: sesión activa, sin empezar y con plaza libre AHORA.
  if not found or v_clase.estado <> 'activa'
     or public.sesion_ya_empezo(v_clase.fecha, v_clase.hora)
     or v_clase.plazas_ocupadas >= v_clase.plazas_max then
    update public.episodios_plaza set estado = 'descartado', motivo = 'ya no procede', procesado_at = now() where id = p_episodio;
    return 0;
  end if;

  -- Antiabuso: no repetir ronda en menos de 60 s ni más de 6 rondas por sesión y hora.
  if exists (select 1 from public.episodios_plaza e
              where e.clase_id = v_ep.clase_id and e.id <> p_episodio and e.estado = 'procesado' and e.notificados > 0
                and e.procesado_at > now() - interval '60 seconds') then
    update public.episodios_plaza set estado = 'omitido', motivo = 'ronda reciente', procesado_at = now() where id = p_episodio;
    return 0;
  end if;
  select count(*) into v_rondas from public.episodios_plaza e
   where e.clase_id = v_ep.clase_id and e.id <> p_episodio and e.estado = 'procesado' and e.notificados > 0
     and e.procesado_at > now() - interval '1 hour';
  if v_rondas >= 6 then
    update public.episodios_plaza set estado = 'omitido', motivo = 'límite por hora', procesado_at = now() where id = p_episodio;
    return 0;
  end if;

  v_dia := case
    when v_clase.fecha = v_hoy then 'hoy'
    when v_clase.fecha = v_hoy + 1 then 'mañana'
    else 'el ' || to_char(v_clase.fecha, 'DD/MM')
  end;
  v_cuerpo := 'Hay una plaza disponible en ' || v_clase.titulo || ', ' || v_dia || ' a las ' || to_char(v_clase.hora, 'HH24:MI');

  -- TODOS los interesados elegibles, sin orden de prioridad: alerta activa, no es el organizador, sin reserva
  -- activa, sin bloqueo entre ellos y sin aviso previo por este episodio.
  for v_usuario in
    select a.usuario_id
      from public.alertas_plaza a
     where a.clase_id = v_ep.clase_id
       and a.estado = 'activa'
       and a.usuario_id <> v_clase.trainer_id
       and not exists (select 1 from public.reservas r where r.clase_id = v_ep.clase_id and r.cliente_id = a.usuario_id and r.estado = 'activa')
       and not exists (select 1 from public.bloqueos b
                        where (b.bloqueador_id = v_clase.trainer_id and b.bloqueado_id = a.usuario_id)
                           or (b.bloqueador_id = a.usuario_id and b.bloqueado_id = v_clase.trainer_id))
       and not exists (select 1 from public.avisos_plaza_enviados s where s.episodio_id = p_episodio and s.usuario_id = a.usuario_id)
  loop
    begin
      insert into public.avisos_plaza_enviados (episodio_id, usuario_id) values (p_episodio, v_usuario)
        on conflict do nothing;
      if found then
        perform public.generar_notificacion(v_usuario, 'plaza_libre', '¡Se ha liberado una plaza!', v_cuerpo, '/clases/' || v_clase.id);
        v_nuevos := v_nuevos + 1;
      end if;
    exception when others then
      v_fallos := v_fallos + 1; -- este usuario NO queda marcado como avisado: se reintentará
    end;
  end loop;

  if v_fallos = 0 then
    update public.episodios_plaza
       set estado = 'procesado', notificados = notificados + v_nuevos, procesado_at = now(), motivo = null
     where id = p_episodio;
  else
    update public.episodios_plaza
       set estado = case when intentos + 1 >= 5 then 'fallido' else 'error' end,
           intentos = intentos + 1, notificados = notificados + v_nuevos, motivo = 'fallos parciales: ' || v_fallos
     where id = p_episodio;
  end if;

  return v_nuevos;
end;
$$;

-- Recupera episodios pendientes o con error (cron). Devuelve cuántos avisos se crearon.
create or replace function public.procesar_episodios_plaza_pendientes()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ep     uuid;
  v_total  integer := 0;
begin
  for v_ep in
    select id from public.episodios_plaza
     where estado in ('pendiente', 'error') and intentos < 5 and created_at > now() - interval '6 hours'
     order by created_at
     limit 200
  loop
    begin
      v_total := v_total + public.procesar_episodio_plaza(v_ep);
    exception when others then
      update public.episodios_plaza set intentos = intentos + 1, estado = case when intentos + 1 >= 5 then 'fallido' else 'error' end
       where id = v_ep;
    end;
  end loop;
  if v_total > 0 then
    perform public.empujar_cola_notificaciones();
  end if;
  return v_total;
end;
$$;

-- Limpieza: alertas de sesiones empezadas/canceladas/eliminadas y episodios antiguos.
create or replace function public.limpiar_avisos_plaza()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  delete from public.alertas_plaza a
   using public.clases c
   where c.id = a.clase_id
     and (c.estado <> 'activa' or public.sesion_ya_empezo(c.fecha, c.hora));
  get diagnostics v_n = row_count;
  delete from public.alertas_plaza where estado = 'desactivada' and updated_at < now() - interval '7 days';
  delete from public.episodios_plaza where created_at < now() - interval '30 days';
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Detección: constraint trigger DIFERIDO sobre clases (se evalúa al confirmar, con el estado final)
-- ---------------------------------------------------------------------------
create or replace function public.detectar_plaza_liberada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clase    record;
  v_episodio uuid;
begin
  -- Blindado: CUALQUIER error aquí se traga, para que una cancelación o reserva válida nunca falle por los avisos.
  -- Si algo no llega a registrarse, el cron de recuperación no puede ayudar (no hay episodio): por eso el registro
  -- del episodio es lo primero y lo único imprescindible; el resto se reintenta desde el episodio.
  begin
  -- Transición real: antes completa, ahora con plazas, y la sesión estaba y está activa.
  if not (old.estado = 'activa' and new.estado = 'activa'
          and old.plazas_max > 0
          and old.plazas_ocupadas >= old.plazas_max
          and new.plazas_ocupadas < new.plazas_max) then
    return null;
  end if;

  -- Estado FINAL de la transacción (puede haberse cancelado la sesión después, o volver a completarse).
  select id, estado, fecha, hora, plazas_max, plazas_ocupadas into v_clase from public.clases where id = new.id;
  if not found or v_clase.estado <> 'activa'
     or v_clase.plazas_ocupadas >= v_clase.plazas_max
     or public.sesion_ya_empezo(v_clase.fecha, v_clase.hora) then
    return null;
  end if;

  -- Sin interesados no hace falta episodio.
  if not exists (select 1 from public.alertas_plaza where clase_id = new.id and estado = 'activa') then
    return null;
  end if;

  insert into public.episodios_plaza (clase_id, tx_id)
  values (new.id, txid_current())
  on conflict (clase_id, tx_id) do nothing
  returning id into v_episodio;

  if v_episodio is null then
    return null; -- ya abierto por esta misma transacción
  end if;

  -- Procesamiento inmediato. Si falla, el episodio queda pendiente (ya existe) y lo recupera el cron.
  begin
    perform public.procesar_episodio_plaza(v_episodio);
    perform public.empujar_cola_notificaciones();
  exception when others then
    null;
  end;
  exception when others then
    null; -- blindaje externo
  end;
  return null;
end;
$$;

drop trigger if exists trg_detectar_plaza_liberada on public.clases;
create constraint trigger trg_detectar_plaza_liberada
  after update of plazas_ocupadas, plazas_max, estado on public.clases
  deferrable initially deferred
  for each row execute function public.detectar_plaza_liberada();

-- ---------------------------------------------------------------------------
-- 8. Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.sesion_ya_empezo(date, time) from public, anon, authenticated;
revoke all on function public.empujar_cola_notificaciones() from public, anon, authenticated;
revoke all on function public.procesar_episodio_plaza(uuid) from public, anon, authenticated;
revoke all on function public.procesar_episodios_plaza_pendientes() from public, anon, authenticated;
revoke all on function public.limpiar_avisos_plaza() from public, anon, authenticated;
revoke all on function public.detectar_plaza_liberada() from public, anon, authenticated;
revoke all on function public.desactivar_aviso_al_reservar() from public, anon, authenticated;
revoke all on function public.activar_aviso_plaza(uuid) from public, anon;
revoke all on function public.desactivar_aviso_plaza(uuid) from public, anon;
revoke all on function public.mis_avisos_plaza() from public, anon;
grant execute on function public.activar_aviso_plaza(uuid) to authenticated;
grant execute on function public.desactivar_aviso_plaza(uuid) to authenticated;
grant execute on function public.mis_avisos_plaza() to authenticated;
-- sesion_ya_empezo la usan las funciones SECURITY DEFINER (propietario) y los triggers; no hace falta a clientes.
grant execute on function public.sesion_ya_empezo(date, time) to service_role;
grant execute on function public.procesar_episodios_plaza_pendientes() to service_role;
grant execute on function public.limpiar_avisos_plaza() to service_role;
