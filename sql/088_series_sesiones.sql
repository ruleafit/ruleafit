-- ============================================================================
-- Ruleafit · 088_series_sesiones.sql
-- C07 · Sesiones recurrentes (series).
--
-- Una serie es solo una ETIQUETA que agrupa sesiones normales de `clases`: cada sesión sigue
-- teniendo sus propias reservas, plazas, participantes, cancelaciones, bonos, cobros, asistencia
-- y valoraciones. No hay un sistema paralelo de reservas.
--
-- QUÉ AÑADE
--   · tabla series_sesiones (id, trainer_id, titulo, patron, created_at). RLS: cada organizador
--     solo ve las suyas; sin escrituras directas (solo mediante las funciones de abajo).
--   · columna clases.serie_id (nullable) + índice, y un trigger que impide asignarla/cambiarla
--     desde el cliente (solo las funciones de serie pueden hacerlo).
--   · publicar_serie(datos, sesiones): crea la serie y TODAS sus sesiones en una sola transacción
--     (o todas o ninguna), con límites (máx. 250 sesiones por serie, 10 series/hora y 30/día),
--     protección contra doble envío y comprobación de duplicados y solapes.
--   · cancelar_serie(clase, alcance) y previsualizar_cancelacion_serie(...): alcance
--     'solo_esta' | 'esta_y_siguientes' | 'toda_futura'. Cada sesión se cancela con la función
--     EXISTENTE cancelar_clase (reservas canceladas, plazas, bonos, notificaciones y cobros tal y
--     como ya funcionan); no se aplica la penalización de cancelación tardía del cliente (C33).
--   · editar_serie(clase, alcance, campos): campos seguros mediante la función EXISTENTE
--     editar_clase (mismas reglas: no a menos de 2 h, plazas mín. solo bajan, máx. solo suben);
--     precio y duración SOLO en sesiones sin reservas. Lo que no se puede editar se devuelve
--     como «omitida» con el motivo; nunca se altera una sesión con reservas en silencio.
--   · actualizar_patron_serie(serie, sesiones, patron): añade las sesiones nuevas del patrón y
--     cancela las que sobran SOLO si no tienen reservas; las que tienen reservas se conservan y
--     se informa. Nunca toca sesiones pasadas.
--   · notificar_serie_publicada(...): UNA notificación agrupada por seguidor-favorito en lugar de
--     una por sesión.
--
-- QUÉ MODIFICA (solo para saltarse el comportamiento «una sesión → una acción» cuando la
-- inserción la hace publicar_serie / actualizar_patron_serie, marcada con la variable de
-- transacción ruleafit.serie_rpc = 'on'):
--   · limitar_envios(): no cuenta estas inserciones masivas en el límite de 30 sesiones/hora.
--   · notificar_publicacion_clase(): no notifica sesión a sesión (lo hace la notificación agrupada).
--   Sin la marca, ambas funciones se comportan exactamente igual que antes.
--
-- AVISOS DE ZONA: no se modifican. El motor ya limita a UN aviso por usuario, organizador y día,
-- así que una serie genera como mucho un aviso por usuario.
--
-- Pagos: no se tocan (pagos_activos sigue en false). Reversión: sql/088_series_sesiones_reversion.sql
-- ============================================================================

-- 1) Tabla de series
create table if not exists public.series_sesiones (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.perfiles(id) on delete cascade,
  titulo      text not null,
  patron      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.series_sesiones is
  'Serie de sesiones recurrentes (C07): solo agrupa sesiones normales de clases mediante clases.serie_id. patron = días, horas y fechas con las que se creó/actualizó (informativo).';

create index if not exists series_sesiones_trainer_idx on public.series_sesiones (trainer_id, created_at desc);

alter table public.series_sesiones enable row level security;
revoke all on public.series_sesiones from anon, authenticated;
grant select on public.series_sesiones to authenticated;
drop policy if exists "ver mis series" on public.series_sesiones;
create policy "ver mis series" on public.series_sesiones for select to authenticated using (trainer_id = auth.uid());

-- 2) Relación sesión → serie
alter table public.clases
  add column if not exists serie_id uuid references public.series_sesiones(id) on delete set null;

create index if not exists clases_serie_idx on public.clases (serie_id, fecha, hora) where serie_id is not null;

-- 3) serie_id solo lo asignan las funciones de serie (nunca el cliente, aunque pueda editar sus clases)
create or replace function public.proteger_serie_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('ruleafit.serie_rpc', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.serie_id is not null then
      raise exception 'La serie solo se puede asignar al publicar una serie.' using errcode = '42501';
    end if;
  elsif new.serie_id is not null and new.serie_id is distinct from old.serie_id then
    raise exception 'La serie de una sesión no se puede cambiar.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_serie_id on public.clases;
create trigger trg_proteger_serie_id
  before insert or update of serie_id on public.clases
  for each row execute function public.proteger_serie_id();

-- 4) limitar_envios: las inserciones de publicar_serie / actualizar_patron_serie no cuentan
--    (tienen sus propios límites). Idéntica a la anterior salvo el bloque marcado.
create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid         uuid := auth.uid();
  v_tabla       text := tg_table_name;
  v_col         text;
  v_max_hora    integer;
  v_max_dia     integer;
  v_hora        integer;
  v_dia         integer;
begin
  if v_uid is null then
    return new;
  end if;

  -- NUEVO (sql/088)
  if v_tabla = 'clases' and coalesce(current_setting('ruleafit.serie_rpc', true), '') = 'on' then
    return new;
  end if;

  if v_tabla = 'feedback' then
    v_col := 'user_id';        v_max_hora := 5;   v_max_dia := 20;
  elsif v_tabla = 'denuncias' then
    v_col := 'denunciante_id'; v_max_hora := 10;  v_max_dia := 30;
  elsif v_tabla = 'clases' then
    v_col := 'trainer_id';     v_max_hora := 30;  v_max_dia := 100;
  else
    return new;
  end if;

  -- NUEVO (sql/088): las sesiones de una serie no cuentan en este límite (las series tienen el suyo).
  execute format(
    'select count(*) filter (where created_at > now() - interval ''1 hour''),
            count(*) filter (where created_at > now() - interval ''1 day'')
       from public.%I where %I = $1 and created_at > now() - interval ''1 day'' %s',
    v_tabla, v_col, case when v_tabla = 'clases' then 'and serie_id is null' else '' end
  ) into v_hora, v_dia using v_uid;

  if v_hora >= v_max_hora or v_dia >= v_max_dia then
    raise exception 'Has hecho demasiados envíos en poco tiempo. Inténtalo de nuevo más tarde.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 5) notificar_publicacion_clase: sin notificar sesión a sesión dentro de una serie.
--    Idéntica a la anterior (sql/086) salvo el bloque marcado.
create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_destinatario uuid;
begin
  -- NUEVO (sql/088): la serie envía una única notificación agrupada.
  if coalesce(current_setting('ruleafit.serie_rpc', true), '') = 'on' then
    return new;
  end if;

  -- Solo notificamos si la clase se crea activa.
  if new.estado is distinct from 'activa' then
    return new;
  end if;

  -- Nombre visible del autor.
  select username into v_username
  from public.perfiles
  where id = new.trainer_id;

  if v_username is null then
    v_username := 'Tu entrenador';
  end if;

  -- Una notificacion por cada usuario que tiene al autor en favoritos y no ha
  -- desactivado "Nuevas sesiones de mis ruleros favoritos" (categoria
  -- 'publicaciones'; sin fila = activa). Los seguidores que no lo tienen en
  -- favoritos NO reciben nada. Tampoco quien tenga un bloqueo con el autor.
  for v_destinatario in
    select f.usuario_id
    from public.favoritos f
    where f.favorito_id = new.trainer_id
      and coalesce(
            (select pn.activo
               from public.preferencias_notificaciones pn
              where pn.usuario_id = f.usuario_id
                and pn.categoria = 'publicaciones'),
            true
          )
      and not exists (
            select 1 from public.bloqueos b
             where (b.bloqueador_id = new.trainer_id and b.bloqueado_id = f.usuario_id)
                or (b.bloqueador_id = f.usuario_id and b.bloqueado_id = new.trainer_id))
  loop
    perform public.generar_notificacion(
      v_destinatario,
      'sesion_publicada',
      'Nueva sesion de ' || v_username,
      v_username || ' ha publicado: ' || new.titulo,
      '/clases/' || new.id::text
    );
  end loop;

  return new;
end;
$$;

-- 6) Notificación agrupada (interna): misma audiencia y filtros que la notificación de una sesión.
create or replace function public.notificar_serie_publicada(
  p_trainer_id uuid,
  p_titulo     text,
  p_n          integer,
  p_primera_id uuid,
  p_verbo      text default 'publicado'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_dest     uuid;
  v_enviadas integer := 0;
  v_cuerpo   text;
begin
  select username into v_username from public.perfiles where id = p_trainer_id;
  v_username := coalesce(v_username, 'Tu entrenador');

  if p_n = 1 then
    v_cuerpo := v_username || ' ha ' || p_verbo || ': ' || p_titulo;
  else
    v_cuerpo := v_username || ' ha ' || p_verbo || ' ' || p_n || ' nuevas sesiones de ' || p_titulo;
  end if;

  for v_dest in
    select f.usuario_id
      from public.favoritos f
     where f.favorito_id = p_trainer_id
       and coalesce((select pn.activo from public.preferencias_notificaciones pn
                      where pn.usuario_id = f.usuario_id and pn.categoria = 'publicaciones'), true)
       and not exists (
             select 1 from public.bloqueos b
              where (b.bloqueador_id = p_trainer_id and b.bloqueado_id = f.usuario_id)
                 or (b.bloqueador_id = f.usuario_id and b.bloqueado_id = p_trainer_id))
  loop
    perform public.generar_notificacion(
      v_dest,
      'sesion_publicada',
      case when p_n = 1 then 'Nueva sesion de ' || v_username else 'Nuevas sesiones de ' || v_username end,
      v_cuerpo,
      '/clases/' || p_primera_id::text
    );
    v_enviadas := v_enviadas + 1;
  end loop;

  return v_enviadas;
end;
$$;

revoke all on function public.notificar_serie_publicada(uuid, text, integer, uuid, text) from public, anon, authenticated;

-- 7) Publicación atómica de una serie
create or replace function public.publicar_serie(p_datos jsonb, p_sesiones jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max constant integer := 250;
  v_uid       uuid;
  v_n         integer;
  v_dur       integer;
  v_titulo    text;
  v_serie     uuid;
  v_primera   uuid;
  v_horas     integer;
  v_dias      integer;
  v_notif     integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_sesiones) is distinct from 'array' then
    raise exception 'Faltan las sesiones de la serie.' using errcode = 'P0001';
  end if;
  v_n := jsonb_array_length(p_sesiones);
  if v_n < 1 then
    raise exception 'La serie no tiene ninguna sesión.' using errcode = 'P0001';
  end if;
  if v_n > c_max then
    raise exception 'Una serie puede tener como máximo % sesiones. Acorta el periodo o divide la publicación.', c_max using errcode = 'P0001';
  end if;

  v_titulo := nullif(btrim(coalesce(p_datos->>'titulo', '')), '');
  if v_titulo is null then
    raise exception 'La serie necesita un título.' using errcode = 'P0001';
  end if;
  v_dur := nullif(p_datos->>'duracion', '')::integer;

  -- Un solo envío a la vez por organizador (doble clic, dos pestañas…).
  perform pg_advisory_xact_lock(hashtext('serie:' || v_uid::text));

  -- Límites de series por organizador.
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*) filter (where created_at > now() - interval '1 day')
    into v_horas, v_dias
    from public.series_sesiones
   where trainer_id = v_uid and created_at > now() - interval '1 day';
  if v_horas >= 10 or v_dias >= 30 then
    raise exception 'Has publicado demasiadas series en poco tiempo. Inténtalo de nuevo más tarde.' using errcode = 'P0001';
  end if;

  -- Doble envío: misma serie (título y patrón) hace menos de 2 minutos.
  if exists (select 1 from public.series_sesiones s
              where s.trainer_id = v_uid and s.titulo = v_titulo
                and s.patron = coalesce(p_datos->'patron', '{}'::jsonb)
                and s.created_at > now() - interval '2 minutes') then
    raise exception 'Esta serie se acaba de publicar. Revisa «Mis sesiones publicadas».' using errcode = 'P0001';
  end if;

  -- Fechas y horas válidas, sin repeticiones y sin solapes entre las sesiones de la serie.
  if exists (select 1 from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time) where x.fecha is null or x.hora is null) then
    raise exception 'Alguna sesión no tiene fecha u hora.' using errcode = 'P0001';
  end if;
  if (select count(*) from (select distinct x.fecha, x.hora from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)) d) <> v_n then
    raise exception 'Hay sesiones repetidas (misma fecha y hora).' using errcode = 'P0001';
  end if;
  if v_dur is not null and v_dur > 0 and exists (
       select 1 from (
         select x.hora, lag(x.hora) over (partition by x.fecha order by x.hora) as previa
           from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)) t
        where t.previa is not null and t.previa + make_interval(mins => v_dur) > t.hora) then
    raise exception 'Hay sesiones de la serie que se solapan según su duración.' using errcode = 'P0001';
  end if;

  insert into public.series_sesiones (trainer_id, titulo, patron)
  values (v_uid, v_titulo, coalesce(p_datos->'patron', '{}'::jsonb))
  returning id into v_serie;

  -- Las inserciones se marcan para que los triggers no cuenten ni notifiquen sesión a sesión.
  perform set_config('ruleafit.serie_rpc', 'on', true);

  insert into public.clases (
    trainer_id, serie_id, titulo, categoria, tipo_actividad, ciudad, provincia, direccion, punto_encuentro,
    fecha, hora, duracion, nivel, precio, plazas_max, plazas_min, material, observaciones, estado, plazas_ocupadas, lat, lng)
  select v_uid, v_serie, v_titulo,
         p_datos->>'categoria', p_datos->>'tipo_actividad', p_datos->>'ciudad',
         nullif(p_datos->>'provincia', ''), p_datos->>'direccion', p_datos->>'punto_encuentro',
         x.fecha, x.hora, v_dur, p_datos->>'nivel',
         coalesce(nullif(p_datos->>'precio', '')::numeric, 0),
         coalesce(nullif(p_datos->>'plazas_max', '')::integer, 10),
         coalesce(nullif(p_datos->>'plazas_min', '')::integer, 0),
         p_datos->>'material', p_datos->>'observaciones', 'activa', 0,
         nullif(p_datos->>'lat', '')::double precision, nullif(p_datos->>'lng', '')::double precision
    from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)
   order by x.fecha, x.hora;

  perform set_config('ruleafit.serie_rpc', 'off', true);

  select c.id into v_primera from public.clases c where c.serie_id = v_serie order by c.fecha, c.hora limit 1;

  v_notif := public.notificar_serie_publicada(v_uid, v_titulo, v_n, v_primera, 'publicado');

  return jsonb_build_object('ok', true, 'serie_id', v_serie, 'creadas', v_n, 'primera_id', v_primera, 'notificados', v_notif);
end;
$$;

-- 8) Sesiones objetivo de una operación sobre la serie (interna): activas y que no han empezado.
create or replace function public.serie_sesiones_objetivo(p_clase_id uuid, p_alcance text)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_clase record;
  v_ahora timestamp := (now() at time zone 'Europe/Madrid');
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_alcance not in ('solo_esta', 'esta_y_siguientes', 'toda_futura') then
    raise exception 'Alcance no válido.' using errcode = 'P0001';
  end if;

  select c.id, c.trainer_id, c.serie_id, c.fecha, c.hora into v_clase from public.clases c where c.id = p_clase_id;
  if not found then
    raise exception 'La sesión no existe.' using errcode = 'P0002';
  end if;
  if v_clase.trainer_id <> v_uid then
    raise exception 'Solo puedes gestionar tus propias sesiones.' using errcode = '42501';
  end if;
  if v_clase.serie_id is null and p_alcance <> 'solo_esta' then
    raise exception 'Esta sesión no pertenece a ninguna serie.' using errcode = 'P0001';
  end if;

  if p_alcance = 'solo_esta' then
    return query
      select c.id from public.clases c
       where c.id = p_clase_id and c.estado = 'activa'
         and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora;
  elsif p_alcance = 'esta_y_siguientes' then
    return query
      select c.id from public.clases c
       where c.serie_id = v_clase.serie_id and c.trainer_id = v_uid and c.estado = 'activa'
         and (c.fecha, c.hora) >= (v_clase.fecha, v_clase.hora)
         and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora
       order by c.fecha, c.hora;
  else
    return query
      select c.id from public.clases c
       where c.serie_id = v_clase.serie_id and c.trainer_id = v_uid and c.estado = 'activa'
         and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora
       order by c.fecha, c.hora;
  end if;
end;
$$;

revoke all on function public.serie_sesiones_objetivo(uuid, text) from public, anon, authenticated;

-- 9) Vista previa de una cancelación (para la confirmación: cuántas sesiones y cuántas con reservas)
create or replace function public.previsualizar_cancelacion_serie(p_clase_id uuid, p_alcance text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesiones integer;
  v_con      integer;
  v_reservas integer;
begin
  select count(*),
         count(*) filter (where exists (select 1 from public.reservas r where r.clase_id = o.id and r.estado = 'activa')),
         coalesce(sum((select count(*) from public.reservas r where r.clase_id = o.id and r.estado = 'activa')), 0)
    into v_sesiones, v_con, v_reservas
    from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o;
  return jsonb_build_object('sesiones', v_sesiones, 'con_reservas', v_con, 'reservas', v_reservas);
end;
$$;

-- 10) Cancelar sesiones de una serie con la lógica EXISTENTE de cancelar_clase
create or replace function public.cancelar_serie(p_clase_id uuid, p_alcance text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_r        jsonb;
  v_sesiones integer := 0;
  v_con      integer := 0;
  v_reservas integer := 0;
  v_n        integer;
begin
  -- Una operación a la vez por serie/organizador.
  perform pg_advisory_xact_lock(hashtext('serie_op:' || coalesce(auth.uid()::text, '')));

  for v_id in
    select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
      join public.clases c on c.id = o.id order by c.fecha, c.hora
  loop
    v_r := public.cancelar_clase(v_id);   -- cancela reservas, libera plazas, notifica y respeta bonos/cobros como siempre
    v_n := coalesce((v_r->>'reservas_canceladas')::integer, 0);
    v_sesiones := v_sesiones + 1;
    v_reservas := v_reservas + v_n;
    if v_n > 0 then v_con := v_con + 1; end if;
  end loop;

  if v_sesiones = 0 then
    raise exception 'No hay sesiones futuras activas que cancelar.' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'sesiones_canceladas', v_sesiones, 'con_reservas', v_con, 'reservas_canceladas', v_reservas);
end;
$$;

-- 11) Editar sesiones de una serie
create or replace function public.editar_serie(p_clase_id uuid, p_alcance text, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_c         record;
  v_editadas  integer := 0;
  v_cond_ok   integer := 0;
  v_cond_omit integer := 0;
  v_omitidas  jsonb := '[]'::jsonb;
  v_hay_cond  boolean;
  v_precio    numeric;
  v_dur       integer;
  v_con_res   boolean;
begin
  perform pg_advisory_xact_lock(hashtext('serie_op:' || coalesce(auth.uid()::text, '')));

  v_hay_cond := (p_campos ? 'precio') or (p_campos ? 'duracion');
  if p_campos ? 'precio' then
    v_precio := nullif(p_campos->>'precio', '')::numeric;
    if v_precio is null or v_precio < 0 or v_precio <> round(v_precio, 2) then
      raise exception 'El precio debe ser un importe válido con un máximo de 2 decimales.' using errcode = 'P0001';
    end if;
  end if;
  if p_campos ? 'duracion' then
    v_dur := nullif(p_campos->>'duracion', '')::integer;
    if v_dur is null or v_dur < 1 then
      raise exception 'La duración debe ser un número de minutos mayor que 0.' using errcode = 'P0001';
    end if;
    -- La nueva duración no puede hacer que se solapen sesiones de la misma serie el mismo día.
    if exists (
         select 1
           from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
           join public.clases a on a.id = o.id
           join public.clases b on b.serie_id = a.serie_id and b.fecha = a.fecha and b.estado = 'activa' and b.hora > a.hora
          where a.hora + make_interval(mins => v_dur) > b.hora) then
      raise exception 'Con esa duración se solaparían sesiones de la serie el mismo día.' using errcode = 'P0001';
    end if;
  end if;

  for v_id in
    select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
      join public.clases c on c.id = o.id order by c.fecha, c.hora
  loop
    select c.* into v_c from public.clases c where c.id = v_id;

    -- Campos seguros: la función EXISTENTE editar_clase aplica sus propias reglas.
    begin
      perform public.editar_clase(
        v_id,
        coalesce(nullif(btrim(p_campos->>'titulo'), ''), v_c.titulo),
        coalesce(p_campos->>'tipo_actividad', v_c.tipo_actividad),
        coalesce(p_campos->>'categoria', v_c.categoria),
        coalesce(p_campos->>'nivel', v_c.nivel),
        case when p_campos ? 'material' then p_campos->>'material' else v_c.material end,
        case when p_campos ? 'observaciones' then p_campos->>'observaciones' else v_c.observaciones end,
        case when p_campos ? 'punto_encuentro' then p_campos->>'punto_encuentro' else v_c.punto_encuentro end,
        coalesce(nullif(p_campos->>'plazas_min', '')::integer, v_c.plazas_min),
        coalesce(nullif(p_campos->>'plazas_max', '')::integer, v_c.plazas_max)
      );
      v_editadas := v_editadas + 1;
    exception when others then
      v_omitidas := v_omitidas || jsonb_build_array(jsonb_build_object(
        'clase_id', v_id, 'fecha', v_c.fecha, 'hora', v_c.hora, 'motivo', sqlerrm));
      continue;
    end;

    -- Condiciones relevantes (precio, duración): solo si la sesión no tiene reservas activas.
    if v_hay_cond then
      select exists (select 1 from public.reservas r where r.clase_id = v_id and r.estado = 'activa') into v_con_res;
      if v_con_res then
        v_cond_omit := v_cond_omit + 1;
        v_omitidas := v_omitidas || jsonb_build_array(jsonb_build_object(
          'clase_id', v_id, 'fecha', v_c.fecha, 'hora', v_c.hora,
          'motivo', 'Tiene reservas: el precio y la duración no se han modificado.'));
      else
        update public.clases
           set precio = coalesce(v_precio, precio),
               duracion = coalesce(v_dur, duracion)
         where id = v_id;
        v_cond_ok := v_cond_ok + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'editadas', v_editadas, 'omitidas', v_omitidas,
                            'condiciones_aplicadas', v_cond_ok, 'condiciones_omitidas', v_cond_omit);
end;
$$;

-- 12) Cambiar el patrón de días y horas (futuro) de una serie, de forma controlada
create or replace function public.actualizar_patron_serie(p_serie_id uuid, p_sesiones jsonb, p_patron jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max constant integer := 250;
  v_uid      uuid := auth.uid();
  v_serie    record;
  v_plantilla record;
  v_ahora    timestamp := (now() at time zone 'Europe/Madrid');
  v_n        integer;
  v_anad     integer := 0;
  v_canc     integer := 0;
  v_cons     integer := 0;
  v_conservadas jsonb := '[]'::jsonb;
  v_r        record;
  v_primera  uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  select s.id, s.trainer_id, s.titulo into v_serie from public.series_sesiones s where s.id = p_serie_id;
  if not found then
    raise exception 'La serie no existe.' using errcode = 'P0002';
  end if;
  if v_serie.trainer_id <> v_uid then
    raise exception 'Solo puedes gestionar tus propias series.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('serie_op:' || v_uid::text));

  if jsonb_typeof(p_sesiones) is distinct from 'array' then
    raise exception 'Faltan las sesiones del nuevo patrón.' using errcode = 'P0001';
  end if;
  v_n := jsonb_array_length(p_sesiones);
  if v_n > c_max then
    raise exception 'Una serie puede tener como máximo % sesiones futuras.', c_max using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)
              where x.fecha is null or x.hora is null or (x.fecha::text || ' ' || x.hora::text)::timestamp < v_ahora) then
    raise exception 'Todas las sesiones del nuevo patrón deben tener fecha y hora futuras.' using errcode = 'P0001';
  end if;
  if (select count(*) from (select distinct x.fecha, x.hora from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)) d) <> v_n then
    raise exception 'Hay sesiones repetidas (misma fecha y hora).' using errcode = 'P0001';
  end if;

  -- Plantilla: la sesión futura activa más próxima o, si no hay, la última de la serie.
  select c.* into v_plantilla
    from public.clases c
   where c.serie_id = p_serie_id and c.trainer_id = v_uid
   order by (c.estado = 'activa' and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora) desc,
            case when c.estado = 'activa' and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora then c.fecha end asc nulls last,
            c.fecha desc, c.hora desc
   limit 1;
  if not found then
    raise exception 'La serie no tiene sesiones.' using errcode = 'P0001';
  end if;

  if v_plantilla.duracion is not null and v_plantilla.duracion > 0 and exists (
       select 1 from (
         select x.hora, lag(x.hora) over (partition by x.fecha order by x.hora) as previa
           from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)) t
        where t.previa is not null and t.previa + make_interval(mins => v_plantilla.duracion) > t.hora) then
    raise exception 'Hay sesiones del nuevo patrón que se solapan según su duración.' using errcode = 'P0001';
  end if;

  -- Sesiones que sobran: futuras, activas, de la serie y que no están en el nuevo patrón.
  for v_r in
    select c.id, c.fecha, c.hora,
           (select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'activa') as reservas
      from public.clases c
     where c.serie_id = p_serie_id and c.trainer_id = v_uid and c.estado = 'activa'
       and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora
       and not exists (select 1 from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time) where x.fecha = c.fecha and x.hora = c.hora)
     order by c.fecha, c.hora
  loop
    if v_r.reservas = 0 then
      perform public.cancelar_clase(v_r.id);   -- sin reservas: no hay nadie a quien avisar
      v_canc := v_canc + 1;
    else
      v_cons := v_cons + 1;
      v_conservadas := v_conservadas || jsonb_build_array(jsonb_build_object(
        'clase_id', v_r.id, 'fecha', v_r.fecha, 'hora', v_r.hora, 'reservas', v_r.reservas));
    end if;
  end loop;

  -- Sesiones nuevas: las del patrón que aún no existen (activas) en la serie.
  perform set_config('ruleafit.serie_rpc', 'on', true);
  with nuevas as (
    insert into public.clases (
      trainer_id, serie_id, titulo, categoria, tipo_actividad, ciudad, provincia, direccion, punto_encuentro,
      fecha, hora, duracion, nivel, precio, plazas_max, plazas_min, material, observaciones, estado, plazas_ocupadas, lat, lng)
    select v_uid, p_serie_id, v_plantilla.titulo, v_plantilla.categoria, v_plantilla.tipo_actividad, v_plantilla.ciudad,
           v_plantilla.provincia, v_plantilla.direccion, v_plantilla.punto_encuentro,
           x.fecha, x.hora, v_plantilla.duracion, v_plantilla.nivel, v_plantilla.precio, v_plantilla.plazas_max,
           v_plantilla.plazas_min, v_plantilla.material, v_plantilla.observaciones, 'activa', 0, v_plantilla.lat, v_plantilla.lng
      from jsonb_to_recordset(p_sesiones) as x(fecha date, hora time)
     where not exists (select 1 from public.clases c
                        where c.serie_id = p_serie_id and c.estado = 'activa' and c.fecha = x.fecha and c.hora = x.hora)
     order by x.fecha, x.hora
    returning id, fecha, hora)
  select count(*), (array_agg(id order by fecha, hora))[1] into v_anad, v_primera from nuevas;
  perform set_config('ruleafit.serie_rpc', 'off', true);

  update public.series_sesiones set patron = coalesce(p_patron, patron) where id = p_serie_id;

  if v_anad > 0 then
    perform public.notificar_serie_publicada(v_uid, v_serie.titulo, v_anad, v_primera, 'añadido');
  end if;

  return jsonb_build_object('ok', true, 'anadidas', v_anad, 'canceladas', v_canc,
                            'conservadas_con_reservas', v_cons, 'conservadas', v_conservadas);
end;
$$;

-- 13) Permisos: solo usuarios autenticados (cada función comprueba además que la serie/sesión es suya)
revoke all on function public.publicar_serie(jsonb, jsonb) from public, anon;
revoke all on function public.previsualizar_cancelacion_serie(uuid, text) from public, anon;
revoke all on function public.cancelar_serie(uuid, text) from public, anon;
revoke all on function public.editar_serie(uuid, text, jsonb) from public, anon;
revoke all on function public.actualizar_patron_serie(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.publicar_serie(jsonb, jsonb) to authenticated;
grant execute on function public.previsualizar_cancelacion_serie(uuid, text) to authenticated;
grant execute on function public.cancelar_serie(uuid, text) to authenticated;
grant execute on function public.editar_serie(uuid, text, jsonb) to authenticated;
grant execute on function public.actualizar_patron_serie(uuid, jsonb, jsonb) to authenticated;
