-- ============================================================================
-- Ruleafit · 089_valoraciones_y_avisos.sql
-- C16 · Solicitud automática de valoraciones   +   C18 · Avisos del organizador a participantes
--
-- Reutiliza la infraestructura de notificaciones existente: generar_notificacion() (campana +
-- cola de push + preferencias), el cron de pg_cron y las tablas de reservas/valoraciones. No hay
-- sistema paralelo de notificaciones ni de valoraciones.
--
-- C16 · CÓMO FUNCIONA
--   · «Asistencia confirmada» = la reserva tiene su movimiento de Rulos 'asistencia_confirmada'
--     (lo concede completar_asistencia_clases_pasadas(), cron cada 15 min, desde que la sesión
--     empieza). La RLS de valoraciones deja valorar desde ese mismo instante (reserva activa y
--     sesión empezada), así que pedir la valoración UNA HORA DESPUÉS de terminar la sesión
--     (inicio + duración + 60 min; 60 min de duración si no consta) nunca llega antes de poder
--     valorar. No se toca la asistencia automática.
--   · solicitar_valoraciones() (cron cada 10 min) avisa una sola vez por usuario y sesión a quien:
--     tiene reserva activa, la sesión sigue activa y ya terminó hace ≥ 1 h (y < 48 h), la
--     asistencia está confirmada, no ha valorado aún a ese organizador (hay una valoración por
--     usuario y organizador), no hay bloqueo entre ambos y no se le ha pedido ya valorar a ese
--     mismo organizador en los últimos 7 días (evita varios avisos seguidos por varias sesiones).
--   · Sin avisos retroactivos: solo cuentan sesiones cuya hora de aviso es posterior a la
--     instalación (solicitudes_valoracion_config.activo_desde).
--   · Aviso: «¿Qué tal tu entrenamiento?» / «Ya has completado tu sesión con @organizador. ¡Cuéntanos
--     qué te ha parecido!» → /entrenador/<usuario>?valorar=1 (formulario de valoración existente).
--
-- C18 · CÓMO FUNCIONA
--   · enviar_aviso_participantes(sesión, mensaje): solo el organizador de la sesión, solo antes de
--     que empiece y mientras esté activa; máx. 3 avisos por sesión (restricción UNIQUE (sesión, orden)
--     + bloqueo de fila/consultivo contra envíos simultáneos) y 300 caracteres. Destinatarios =
--     reservas ACTIVAS en ese momento, calculadas en el servidor, sin bloqueados. Todo en una
--     transacción: o se guarda el aviso y se notifica a todos, o nada (no consume aviso). Un doble clic
--     con el mismo texto (<60 s) devuelve el mismo aviso sin consumir otro. Si alguna notificación no
--     llegara a registrarse, reintentar_aviso() reenvía SOLO a los pendientes sin consumir aviso.
--   · Los avisos guardados no se pueden editar ni borrar desde la web (RLS sin acceso; trigger que
--     impide cambiar el texto). El texto se guarda tal cual y la interfaz lo muestra como texto plano.
--   · Notificación: «Aviso de @organizador» + «<sesión> · DD/MM HH:MM — <mensaje>» → /clases/<id>?aviso=<id>
--     (la ficha muestra el aviso completo a quien lo recibió).
--   · Lectura: avisos_sesion_organizador (historial, restantes y destinatarios actuales) y
--     avisos_sesion_participante (avisos que yo recibí en esa sesión).
--
-- MODIFICA UNA FUNCIÓN EXISTENTE: generar_notificacion() (solo añade 2 categorías desactivables
-- en el CASE: 'solicitud_valoracion' y 'avisos_organizador'; el resto, idéntico).
--
-- Pagos, reservas, bonos y asistencia: no se tocan (solo se leen reservas/clases/valoraciones/Rulos).
-- Cron en 089_valoraciones_y_avisos_cron.sql. Reversión: 089_valoraciones_y_avisos_reversion.sql
-- ============================================================================

-- 0) generar_notificacion: dos categorías nuevas (opt-out como las demás; el historial es siempre)
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
  -- Mapear tipo -> categoria. Para la mayoria, la categoria es el propio tipo.
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
    -- NUEVO (sql/089)
    when 'solicitud_valoracion' then
      v_categoria := 'solicitud_valoracion';
    when 'aviso_organizador' then
      v_categoria := 'avisos_organizador';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      -- Tipo desconocido: por seguridad se envia (critico).
      v_categoria := 'otras';
      v_critica := true;
  end case;

  -- Historial SIEMPRE.
  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  -- Decidir push. Opt-out: sin fila = activa.
  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  -- Encolar push solo si procede.
  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;

-- ============================================================================
-- C16 · Solicitud automática de valoraciones
-- ============================================================================
create table if not exists public.solicitudes_valoracion (
  id            uuid primary key default gen_random_uuid(),
  clase_id      uuid not null references public.clases(id) on delete cascade,
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  entrenador_id uuid not null references public.perfiles(id) on delete cascade,
  enviada_at    timestamptz not null default now(),
  constraint solicitudes_valoracion_unica unique (clase_id, usuario_id)   -- una solicitud por usuario y sesión
);
create index if not exists solicitudes_valoracion_usuario_idx on public.solicitudes_valoracion (usuario_id, entrenador_id, enviada_at desc);
alter table public.solicitudes_valoracion enable row level security;
revoke all on public.solicitudes_valoracion from anon, authenticated;

create table if not exists public.solicitudes_valoracion_config (
  id           boolean primary key default true check (id),
  activo       boolean not null default true,
  activo_desde timestamptz not null default now()      -- nada anterior a la instalación se avisa
);
insert into public.solicitudes_valoracion_config (id) values (true) on conflict (id) do nothing;
alter table public.solicitudes_valoracion_config enable row level security;
revoke all on public.solicitudes_valoracion_config from anon, authenticated;

create or replace function public.solicitar_valoraciones(p_ahora timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cfg      public.solicitudes_valoracion_config%rowtype;
  v_local    timestamp := (p_ahora at time zone 'Europe/Madrid');
  v_desde    timestamp;
  r          record;
  v_n        integer;
  v_enviadas integer := 0;
begin
  -- Una sola ejecución a la vez (el candado se libera al terminar la transacción).
  if not pg_try_advisory_xact_lock(hashtext('solicitar_valoraciones')::bigint) then
    return jsonb_build_object('estado', 'ocupado');
  end if;

  select * into v_cfg from public.solicitudes_valoracion_config where id;
  if not found or not v_cfg.activo then
    return jsonb_build_object('estado', 'apagado');
  end if;
  v_desde := (v_cfg.activo_desde at time zone 'Europe/Madrid');

  for r in
    select distinct on (x.cliente_id, x.trainer_id)
           x.cliente_id, x.trainer_id, x.clase_id, x.username
      from (
        select re.cliente_id, c.trainer_id, c.id as clase_id, p.username,
               ((c.fecha::text || ' ' || c.hora::text)::timestamp
                  + make_interval(mins => coalesce(nullif(c.duracion, 0), 60))
                  + interval '60 minutes') as listo
          from public.reservas re
          join public.clases c on c.id = re.clase_id
          join public.perfiles p on p.id = c.trainer_id
         where re.estado = 'activa'
           and c.estado = 'activa'
           and re.cliente_id <> c.trainer_id
           -- Asistencia confirmada por el sistema (5 Rulos 'asistencia_confirmada').
           and exists (select 1 from public.rulos_movimientos m
                        where m.referencia_tipo = 'reserva' and m.referencia_id = re.id
                          and m.motivo = 'asistencia_confirmada')
           -- Aún no ha valorado a este organizador (una valoración por usuario y organizador).
           and not exists (select 1 from public.valoraciones v
                            where v.cliente_id = re.cliente_id and v.entrenador_id = c.trainer_id)
           -- Sin bloqueos entre ambos.
           and not exists (select 1 from public.bloqueos b
                            where (b.bloqueador_id = c.trainer_id and b.bloqueado_id = re.cliente_id)
                               or (b.bloqueador_id = re.cliente_id and b.bloqueado_id = c.trainer_id))
           -- Ya no se le ha pedido valorar a este organizador en la última semana.
           and not exists (select 1 from public.solicitudes_valoracion s
                            where s.usuario_id = re.cliente_id and s.entrenador_id = c.trainer_id
                              and s.enviada_at > p_ahora - interval '7 days')
      ) x
     where x.listo <= v_local                              -- ya ha pasado 1 h desde que terminó
       and x.listo >  v_local - interval '48 hours'        -- sin avisos tardíos
       and x.listo >  v_desde                              -- sin retroactivos
     order by x.cliente_id, x.trainer_id, x.listo desc
     limit 500
  loop
    begin
      insert into public.solicitudes_valoracion (clase_id, usuario_id, entrenador_id, enviada_at)
      values (r.clase_id, r.cliente_id, r.trainer_id, p_ahora)
      on conflict (clase_id, usuario_id) do nothing;
      get diagnostics v_n = row_count;
      if v_n = 1 then
        perform public.generar_notificacion(
          r.cliente_id,
          'solicitud_valoracion',
          '¿Qué tal tu entrenamiento?',
          'Ya has completado tu sesión con @' || r.username || '. ¡Cuéntanos qué te ha parecido!',
          '/entrenador/' || r.username || '?valorar=1'
        );
        v_enviadas := v_enviadas + 1;
      end if;
    exception when others then
      -- Un fallo con un usuario no afecta a los demás: se deshace su solicitud y se reintenta en la
      -- siguiente ejecución.
      null;
    end;
  end loop;

  return jsonb_build_object('estado', 'ok', 'enviadas', v_enviadas);
end;
$$;

revoke all on function public.solicitar_valoraciones(timestamptz) from public, anon, authenticated;

-- ============================================================================
-- C18 · Avisos del organizador a participantes
-- ============================================================================
create table if not exists public.avisos_organizador (
  id            uuid primary key default gen_random_uuid(),
  clase_id      uuid not null references public.clases(id) on delete cascade,
  trainer_id    uuid not null references public.perfiles(id) on delete cascade,
  orden         smallint not null check (orden between 1 and 3),
  mensaje       text not null check (char_length(mensaje) between 1 and 300),
  destinatarios integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint avisos_organizador_orden_unico unique (clase_id, orden)   -- garantía dura: máx. 3 por sesión
);
alter table public.avisos_organizador enable row level security;
revoke all on public.avisos_organizador from anon, authenticated;

create table if not exists public.avisos_organizador_destinatarios (
  aviso_id     uuid not null references public.avisos_organizador(id) on delete cascade,
  usuario_id   uuid not null references public.perfiles(id) on delete cascade,
  notificado_at timestamptz,
  primary key (aviso_id, usuario_id)
);
create index if not exists avisos_dest_usuario_idx on public.avisos_organizador_destinatarios (usuario_id);
alter table public.avisos_organizador_destinatarios enable row level security;
revoke all on public.avisos_organizador_destinatarios from anon, authenticated;

-- Un aviso ya enviado no se puede reescribir (ni siquiera por funciones): solo cambia el recuento/estado.
create or replace function public.proteger_aviso_enviado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.mensaje is distinct from old.mensaje or new.clase_id is distinct from old.clase_id
     or new.trainer_id is distinct from old.trainer_id or new.orden is distinct from old.orden then
    raise exception 'Un aviso ya enviado no se puede modificar.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_aviso_enviado on public.avisos_organizador;
create trigger trg_proteger_aviso_enviado before update on public.avisos_organizador
  for each row execute function public.proteger_aviso_enviado();

-- Destinatarios actuales de una sesión: reservas activas, sin bloqueos con el organizador (interna).
create or replace function public.avisos_destinatarios_actuales(p_clase_id uuid)
returns table (usuario_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.cliente_id
    from public.reservas r
    join public.clases c on c.id = r.clase_id
   where r.clase_id = p_clase_id
     and r.estado = 'activa'
     and r.cliente_id <> c.trainer_id
     and not exists (select 1 from public.bloqueos b
                      where (b.bloqueador_id = c.trainer_id and b.bloqueado_id = r.cliente_id)
                         or (b.bloqueador_id = r.cliente_id and b.bloqueado_id = c.trainer_id));
$$;
revoke all on function public.avisos_destinatarios_actuales(uuid) from public, anon, authenticated;

-- Envía las notificaciones pendientes de un aviso (interna): solo a quien aún no la tiene registrada.
create or replace function public.avisos_notificar_pendientes(p_aviso_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a       record;
  v_c       record;
  v_user    text;
  v_dest    uuid;
  v_url     text;
  v_cuerpo  text;
  v_ok      integer := 0;
begin
  select * into v_a from public.avisos_organizador where id = p_aviso_id;
  select titulo, fecha, hora into v_c from public.clases where id = v_a.clase_id;
  select username into v_user from public.perfiles where id = v_a.trainer_id;
  v_url := '/clases/' || v_a.clase_id::text || '?aviso=' || v_a.id::text;
  v_cuerpo := '«' || v_c.titulo || '» · ' || to_char(v_c.fecha, 'DD/MM') || ' ' || left(v_c.hora::text, 5) || ' — ' || v_a.mensaje;

  for v_dest in
    select d.usuario_id from public.avisos_organizador_destinatarios d
     where d.aviso_id = p_aviso_id and d.notificado_at is null
  loop
    perform public.generar_notificacion(v_dest, 'aviso_organizador', 'Aviso de @' || coalesce(v_user, 'tu organizador'), v_cuerpo, v_url);
    -- Se da por entregada solo si quedó registrada en la campana.
    if exists (select 1 from public.notificaciones_historial h
                where h.usuario_id = v_dest and h.tipo = 'aviso_organizador' and h.url = v_url) then
      update public.avisos_organizador_destinatarios set notificado_at = now()
       where aviso_id = p_aviso_id and usuario_id = v_dest;
      v_ok := v_ok + 1;
    end if;
  end loop;
  return v_ok;
end;
$$;
revoke all on function public.avisos_notificar_pendientes(uuid) from public, anon, authenticated;

create or replace function public.enviar_aviso_participantes(p_clase_id uuid, p_mensaje text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_avisos constant integer := 3;
  c_max_chars  constant integer := 300;
  v_uid     uuid := auth.uid();
  v_clase   record;
  v_inicio  timestamp;
  v_msg     text;
  v_prev    record;
  v_n_prev  integer;
  v_dest    integer;
  v_aviso   uuid;
  v_ok      integer;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para enviar un aviso.' using errcode = '28000';
  end if;

  -- Bloqueo de la fila de la sesión: dos envíos simultáneos se ejecutan uno detrás de otro.
  select id, trainer_id, estado, fecha, hora into v_clase from public.clases where id = p_clase_id for update;
  if not found then
    raise exception 'La sesión no existe.' using errcode = 'P0002';
  end if;
  if v_clase.trainer_id <> v_uid then
    raise exception 'Solo el organizador de la sesión puede enviar avisos.' using errcode = '42501';
  end if;
  if v_clase.estado <> 'activa' then
    raise exception 'La sesión está cancelada: no se pueden enviar avisos.' using errcode = 'P0001';
  end if;
  v_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  if v_inicio <= (now() at time zone 'Europe/Madrid') then
    raise exception 'La sesión ya ha comenzado: ya no se pueden enviar avisos.' using errcode = 'P0001';
  end if;

  -- Texto: sin caracteres de control, recortado; entre 1 y 300 caracteres.
  v_msg := btrim(regexp_replace(coalesce(p_mensaje, ''), '[\x01-\x08\x0B-\x1F\x7F]', '', 'g'));
  if char_length(v_msg) = 0 then
    raise exception 'Escribe el mensaje del aviso.' using errcode = 'P0001';
  end if;
  if char_length(v_msg) > c_max_chars then
    raise exception 'El aviso no puede superar los % caracteres.', c_max_chars using errcode = 'P0001';
  end if;

  -- Doble clic / reintento inmediato: el mismo texto en los últimos 60 s devuelve el aviso ya enviado.
  select a.id, a.destinatarios, a.orden into v_prev
    from public.avisos_organizador a
   where a.clase_id = p_clase_id and a.mensaje = v_msg and a.created_at > now() - interval '60 seconds'
   order by a.created_at desc limit 1;
  if found then
    select count(*) into v_n_prev from public.avisos_organizador where clase_id = p_clase_id;
    return jsonb_build_object('ok', true, 'repetido', true, 'aviso_id', v_prev.id, 'destinatarios', v_prev.destinatarios,
                              'restantes', c_max_avisos - v_n_prev);
  end if;

  select count(*) into v_n_prev from public.avisos_organizador where clase_id = p_clase_id;
  if v_n_prev >= c_max_avisos then
    raise exception 'Has alcanzado el máximo de % avisos para esta sesión.', c_max_avisos using errcode = 'P0001';
  end if;

  select count(*) into v_dest from public.avisos_destinatarios_actuales(p_clase_id);
  if v_dest = 0 then
    raise exception 'Esta sesión no tiene participantes con reserva activa.' using errcode = 'P0001';
  end if;

  insert into public.avisos_organizador (clase_id, trainer_id, orden, mensaje, destinatarios)
  values (p_clase_id, v_uid, v_n_prev + 1, v_msg, v_dest)
  returning id into v_aviso;

  insert into public.avisos_organizador_destinatarios (aviso_id, usuario_id)
  select v_aviso, d.usuario_id from public.avisos_destinatarios_actuales(p_clase_id) d;

  v_ok := public.avisos_notificar_pendientes(v_aviso);

  return jsonb_build_object('ok', true, 'repetido', false, 'aviso_id', v_aviso, 'destinatarios', v_dest,
                            'entregados', v_ok, 'restantes', c_max_avisos - (v_n_prev + 1));
end;
$$;

-- Reintento: reenvía solo a quien no tiene registrada la notificación; no consume aviso ni duplica.
create or replace function public.reintentar_aviso(p_aviso_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_a     record;
  v_c     record;
  v_ok    integer;
  v_pend  integer;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select * into v_a from public.avisos_organizador where id = p_aviso_id;
  if not found then
    raise exception 'El aviso no existe.' using errcode = 'P0002';
  end if;
  if v_a.trainer_id <> v_uid then
    raise exception 'Solo el organizador puede reintentar sus avisos.' using errcode = '42501';
  end if;
  select estado, fecha, hora into v_c from public.clases where id = v_a.clase_id for update;
  if v_c.estado <> 'activa' or (v_c.fecha::text || ' ' || v_c.hora::text)::timestamp <= (now() at time zone 'Europe/Madrid') then
    raise exception 'La sesión ya no admite avisos.' using errcode = 'P0001';
  end if;
  -- Solo reenvía a quien sigue con reserva activa.
  delete from public.avisos_organizador_destinatarios d
   where d.aviso_id = p_aviso_id and d.notificado_at is null
     and not exists (select 1 from public.avisos_destinatarios_actuales(v_a.clase_id) x where x.usuario_id = d.usuario_id);
  v_ok := public.avisos_notificar_pendientes(p_aviso_id);
  select count(*) into v_pend from public.avisos_organizador_destinatarios where aviso_id = p_aviso_id and notificado_at is null;
  return jsonb_build_object('ok', true, 'reenviados', v_ok, 'pendientes', v_pend);
end;
$$;

-- Historial y estado para el organizador (panel «Enviar aviso a participantes»)
create or replace function public.avisos_sesion_organizador(p_clase_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_clase   record;
  v_activa  boolean;
  v_n       integer;
  v_dest    integer;
  v_lista   jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select id, trainer_id, estado, fecha, hora into v_clase from public.clases where id = p_clase_id;
  if not found or v_clase.trainer_id <> v_uid then
    raise exception 'Solo el organizador de la sesión puede ver sus avisos.' using errcode = '42501';
  end if;
  v_activa := v_clase.estado = 'activa'
              and (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp > (now() at time zone 'Europe/Madrid');
  select count(*) into v_n from public.avisos_organizador where clase_id = p_clase_id;
  select count(*) into v_dest from public.avisos_destinatarios_actuales(p_clase_id);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'orden', a.orden, 'mensaje', a.mensaje, 'created_at', a.created_at,
           'destinatarios', a.destinatarios,
           'entregados', (select count(*) from public.avisos_organizador_destinatarios d where d.aviso_id = a.id and d.notificado_at is not null)
         ) order by a.orden), '[]'::jsonb)
    into v_lista from public.avisos_organizador a where a.clase_id = p_clase_id;
  return jsonb_build_object(
    'maximo', 3, 'enviados', v_lista, 'restantes', greatest(3 - v_n, 0),
    'destinatarios_actuales', v_dest,
    'puede_enviar', v_activa and v_n < 3 and v_dest > 0,
    'sesion_activa', v_activa);
end;
$$;

-- Avisos que he recibido en una sesión (ficha de la sesión, para participantes)
create or replace function public.avisos_sesion_participante(p_clase_id uuid)
returns table (aviso_id uuid, mensaje text, created_at timestamptz, organizador text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  return query
    select a.id, a.mensaje, a.created_at, p.username
      from public.avisos_organizador a
      join public.avisos_organizador_destinatarios d on d.aviso_id = a.id and d.usuario_id = auth.uid()
      join public.perfiles p on p.id = a.trainer_id
     where a.clase_id = p_clase_id
     order by a.created_at desc;
end;
$$;

-- Permisos: solo usuarios autenticados (cada función comprueba además quién es el organizador / destinatario)
revoke all on function public.enviar_aviso_participantes(uuid, text) from public, anon;
revoke all on function public.reintentar_aviso(uuid) from public, anon;
revoke all on function public.avisos_sesion_organizador(uuid) from public, anon;
revoke all on function public.avisos_sesion_participante(uuid) from public, anon;
grant execute on function public.enviar_aviso_participantes(uuid, text) to authenticated;
grant execute on function public.reintentar_aviso(uuid) to authenticated;
grant execute on function public.avisos_sesion_organizador(uuid) to authenticated;
grant execute on function public.avisos_sesion_participante(uuid) to authenticated;
