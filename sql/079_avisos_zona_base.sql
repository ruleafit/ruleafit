-- ============================================================================
-- Ruleafit · 079_avisos_zona_base.sql
-- «Avisos de sesiones en mi zona» · FASE 1: base de datos.
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual, completo y
-- de una vez, en el SQL Editor de Supabase (proyecto "ruleafit").
--
-- QUÉ HACE (solo crea objetos nuevos; no toca nada de lo que ya existe):
--   1. config_avisos_zona      Interruptor global (una fila, todo APAGADO por defecto).
--   2. avisos_zona             Configuración PRIVADA de cada usuario (zona, radio,
--                              categorías, franja, modalidad, activado).
--   3. avisos_zona_procesadas  Control: qué sesiones nuevas ya evaluó el motor.
--   4. avisos_zona_inmediatos  Control: un aviso inmediato por usuario, organizador
--                              y día (y base del tope diario por usuario).
--   5. avisos_zona_resumenes   Resumen diario enviado (uno por usuario y día) con
--                              las sesiones que contó; lo lee el propio usuario.
--   6. Funciones auxiliares puras (distancia, horizonte de 168 h, 20:30 de Madrid,
--      ventana del resumen, franja horaria) y una función de interruptor.
--
-- QUÉ NO HACE (llega en fases posteriores):
--   * No crea crons, ni triggers sobre clases, ni envía ninguna notificación.
--   * No crea generar_aviso_zona() (Fase 4) ni las funciones de envío.
--   * No modifica generar_notificacion, favoritos, reservas, cancelaciones ni
--     recordatorios. Nada existente depende de lo que crea este archivo.
--
-- PRINCIPIOS:
--   * Mínimo privilegio: la configuración la ve y la edita SOLO su dueño
--     (RLS + permisos por columna). Las tablas de control y el interruptor no
--     son accesibles desde la web (solo funciones SECURITY DEFINER y la clave de
--     servicio). En Supabase "revoke ... from public" NO quita los permisos de
--     anon/authenticated (auditoría, sql/074): se revocan de forma explícita.
--   * Horizonte: EXACTAMENTE 168 horas absolutas desde el momento de evaluación
--     (intervalo de horas sobre timestamptz), también al cambiar el horario.
--   * Zona horaria de negocio: Europe/Madrid. El servidor y pg_cron van en UTC.
--
-- Atómico: todo el archivo va en una transacción; si algo falla, no se aplica nada.
-- Idempotente: se puede volver a ejecutar sin duplicar ni romper nada.
-- Para deshacerlo: sql/079_avisos_zona_reversion.sql. Para comprobarlo después:
-- sql/079_avisos_zona_verificacion.sql.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Interruptor global (una sola fila), igual que config_pagos (sql/071)
-- ----------------------------------------------------------------------------
create table if not exists public.config_avisos_zona (
  id                          boolean primary key default true check (id),  -- una única fila
  inmediatos_activos          boolean  not null default false,  -- interruptor de avisos inmediatos
  resumen_activo              boolean  not null default false,  -- interruptor del resumen diario
  solo_usuarios_prueba        boolean  not null default true,   -- true = solo los de usuarios_prueba
  usuarios_prueba             uuid[]   not null default '{}'
                                check (cardinality(usuarios_prueba) <= 100),
  tope_inmediatos_usuario_dia smallint not null default 5
                                check (tope_inmediatos_usuario_dia between 1 and 50),
  updated_at                  timestamptz not null default now()
);

insert into public.config_avisos_zona (id) values (true) on conflict (id) do nothing;

-- Mantiene updated_at. Función propia (no se reutiliza la de pagos).
create or replace function public.avisos_zona_tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_config_avisos_zona_updated on public.config_avisos_zona;
create trigger trg_config_avisos_zona_updated
  before update on public.config_avisos_zona
  for each row execute function public.avisos_zona_tocar_updated_at();

alter table public.config_avisos_zona enable row level security;
-- Sin políticas ni permisos: solo la clave de servicio y las funciones SECURITY DEFINER.
revoke all on public.config_avisos_zona from public, anon, authenticated;

comment on table public.config_avisos_zona is
  'Interruptor global de Avisos de sesiones en mi zona. Todo apagado por defecto. Con solo_usuarios_prueba = true solo se avisa a los usuarios de usuarios_prueba.';


-- ----------------------------------------------------------------------------
-- 2) avisos_zona: configuración PRIVADA de cada usuario (una fila por usuario)
-- ----------------------------------------------------------------------------
create table if not exists public.avisos_zona (
  usuario_id    uuid primary key references auth.users(id) on delete cascade,
  activo        boolean  not null default false,
  modo          text     not null default 'diario'
                  check (modo in ('inmediato', 'diario')),
  -- Zona habitual: nombre legible + coordenadas (ambas o ninguna).
  zona_nombre   text
                  check (zona_nombre is null or char_length(btrim(zona_nombre)) between 1 and 200),
  zona_lat      double precision check (zona_lat between -90 and 90),
  zona_lng      double precision check (zona_lng between -180 and 180),
  radio_km      smallint not null default 5
                  check (radio_km in (1, 5, 10, 20)),
  -- Mismas 5 categorías que components/publicar/constantes.js.
  categorias    text[]   not null default '{}'
                  check (
                    cardinality(categorias) <= 5
                    and categorias <@ array[
                      'Fuerza / funcional', 'Cardio', 'Yoga / Pilates / movilidad',
                      'Quedadas deportivas', 'Otros'
                    ]::text[]
                  ),
  -- Franja de HORA DE INICIO de la sesión (no la hora del aviso). Ambos extremos
  -- incluidos. No cruza la medianoche. Por defecto, todo el día.
  hora_desde    time     not null default time '00:00',
  hora_hasta    time     not null default time '23:59',
  -- Desde cuándo cuenta la configuración (activación o cambio de modalidad). Lo
  -- fija el trigger de abajo: el usuario no puede escribirlo.
  activo_desde  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint avisos_zona_coords_juntas_chk
    check ((zona_lat is null) = (zona_lng is null)),
  constraint avisos_zona_franja_chk
    check (hora_desde < hora_hasta),
  -- No se puede activar sin zona y sin al menos una categoría.
  constraint avisos_zona_activo_completo_chk
    check (
      not activo
      or (zona_lat is not null and zona_lng is not null and zona_nombre is not null
          and cardinality(categorias) >= 1)
    )
);

-- Para el motor: usuarios activos de una modalidad, acotados por latitud.
create index if not exists avisos_zona_activos_idx
  on public.avisos_zona (modo, zona_lat)
  where activo;

-- Valores controlados por el servidor, aunque el cliente intente enviarlos.
create or replace function public.avisos_zona_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.created_at   := now();
    new.activo_desde := now();
  else
    new.created_at := old.created_at;
    -- Solo al activar o al cambiar de modalidad empieza a contar "desde ahora".
    -- Cambiar zona, radio, categorías o franja NO lo mueve: afecta a lo futuro.
    if (new.activo and not old.activo) or new.modo is distinct from old.modo then
      new.activo_desde := now();
    else
      new.activo_desde := old.activo_desde;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_avisos_zona_antes_de_guardar on public.avisos_zona;
create trigger trg_avisos_zona_antes_de_guardar
  before insert or update on public.avisos_zona
  for each row execute function public.avisos_zona_antes_de_guardar();

-- RLS: cada usuario solo ve y gestiona SU fila.
alter table public.avisos_zona enable row level security;

drop policy if exists "avisos_zona: lee la suya" on public.avisos_zona;
create policy "avisos_zona: lee la suya"
  on public.avisos_zona
  for select to authenticated
  using ( (select auth.uid()) = usuario_id );

drop policy if exists "avisos_zona: crea la suya" on public.avisos_zona;
create policy "avisos_zona: crea la suya"
  on public.avisos_zona
  for insert to authenticated
  with check ( (select auth.uid()) = usuario_id );

drop policy if exists "avisos_zona: edita la suya" on public.avisos_zona;
create policy "avisos_zona: edita la suya"
  on public.avisos_zona
  for update to authenticated
  using ( (select auth.uid()) = usuario_id )
  with check ( (select auth.uid()) = usuario_id );

drop policy if exists "avisos_zona: borra la suya" on public.avisos_zona;
create policy "avisos_zona: borra la suya"
  on public.avisos_zona
  for delete to authenticated
  using ( (select auth.uid()) = usuario_id );

-- Permisos mínimos: sin acceso para anon; authenticated solo lo necesario y las
-- columnas de servidor (activo_desde, created_at, updated_at) no se pueden escribir.
revoke all on public.avisos_zona from public, anon, authenticated;
grant select, delete on public.avisos_zona to authenticated;
grant insert (usuario_id, activo, modo, zona_nombre, zona_lat, zona_lng, radio_km,
              categorias, hora_desde, hora_hasta)
  on public.avisos_zona to authenticated;
-- usuario_id va en el UPDATE porque el "upsert" de PostgREST lo incluye al resolver
-- el conflicto (se reescribe con el mismo valor); la política WITH CHECK impide
-- que apunte a otro usuario.
grant update (usuario_id, activo, modo, zona_nombre, zona_lat, zona_lng, radio_km,
              categorias, hora_desde, hora_hasta)
  on public.avisos_zona to authenticated;

comment on table public.avisos_zona is
  'Configuración privada de Avisos de sesiones en mi zona (una fila por usuario). Contiene la zona habitual (dato personal): solo la ve su dueño. Se borra con la cuenta.';
comment on column public.avisos_zona.activo_desde is
  'Instante desde el que cuenta la configuración (activación o cambio de modalidad). Lo escribe el trigger, no el usuario.';


-- ----------------------------------------------------------------------------
-- 3) Tablas de control (sin acceso desde la web)
-- ----------------------------------------------------------------------------

-- 3a) Sesiones nuevas ya evaluadas por el motor de avisos inmediatos.
--     'reintento' = falló para algún usuario y se volverá a intentar (el aviso a
--     quien ya lo recibió no se repite gracias a avisos_zona_inmediatos);
--     'procesada' = terminada; 'descartada' = se agotaron los reintentos.
create table if not exists public.avisos_zona_procesadas (
  clase_id       uuid primary key references public.clases(id) on delete cascade,
  estado         text not null default 'procesada'
                   check (estado in ('reintento', 'procesada', 'descartada')),
  intentos       smallint not null default 0 check (intentos >= 0),
  ultimo_error   text check (ultimo_error is null or char_length(ultimo_error) <= 500),
  creada_at      timestamptz not null default now(),
  actualizada_at timestamptz not null default now()
);

create index if not exists avisos_zona_procesadas_reintento_idx
  on public.avisos_zona_procesadas (creada_at)
  where estado = 'reintento';

-- 3b) Avisos inmediatos enviados: UNO por usuario, organizador y día (de Madrid).
--     La clave primaria es la garantía de "máximo uno por organizador y día";
--     contar filas de (usuario_id, dia) da el tope global diario por usuario.
create table if not exists public.avisos_zona_inmediatos (
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  organizador_id uuid not null references auth.users(id) on delete cascade,
  dia            date not null,                      -- día de Madrid de la publicación
  clase_id       uuid references public.clases(id) on delete set null,  -- sesión avisada
  creada_at      timestamptz not null default now(),
  primary key (usuario_id, organizador_id, dia),
  check (usuario_id <> organizador_id)
);

create index if not exists avisos_zona_inmediatos_usuario_dia_idx
  on public.avisos_zona_inmediatos (usuario_id, dia);

-- 3c) Resúmenes diarios: UNO por usuario y día. Guarda las sesiones contadas para
--     que la pantalla del resumen coincida con la cifra de la notificación.
create table if not exists public.avisos_zona_resumenes (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users(id) on delete cascade,
  dia                 date not null,                 -- día de Madrid del resumen (las 20:30)
  ventana_desde       timestamptz not null,
  ventana_hasta       timestamptz not null,
  clases_ids          uuid[] not null
                        check (cardinality(clases_ids) between 1 and 500),
  total_sesiones      integer not null,
  total_organizadores integer not null check (total_organizadores >= 1),
  creada_at           timestamptz not null default now(),
  unique (usuario_id, dia),
  check (ventana_desde < ventana_hasta),
  check (total_sesiones = cardinality(clases_ids))
);

-- Control interno: sin políticas ni permisos para la web.
alter table public.avisos_zona_procesadas enable row level security;
alter table public.avisos_zona_inmediatos enable row level security;
alter table public.avisos_zona_resumenes  enable row level security;

revoke all on public.avisos_zona_procesadas from public, anon, authenticated;
revoke all on public.avisos_zona_inmediatos from public, anon, authenticated;
revoke all on public.avisos_zona_resumenes  from public, anon, authenticated;

-- El único acceso de la web: cada usuario LEE sus propios resúmenes (pantalla
-- del resumen, Fase 5). No puede crearlos, editarlos ni borrarlos.
drop policy if exists "avisos_zona_resumenes: lee los suyos" on public.avisos_zona_resumenes;
create policy "avisos_zona_resumenes: lee los suyos"
  on public.avisos_zona_resumenes
  for select to authenticated
  using ( (select auth.uid()) = usuario_id );

grant select on public.avisos_zona_resumenes to authenticated;

comment on table public.avisos_zona_procesadas is
  'Control interno: sesiones nuevas ya evaluadas por el motor de avisos inmediatos.';
comment on table public.avisos_zona_inmediatos is
  'Control interno: un aviso inmediato por (usuario, organizador, día de Madrid). Base del tope diario por usuario.';
comment on table public.avisos_zona_resumenes is
  'Resumen diario ya generado por usuario y día. El usuario puede leer solo los suyos.';


-- ----------------------------------------------------------------------------
-- 4) Funciones auxiliares (puras salvo el interruptor)
--    search_path vacío y todo con su esquema. Ejecutables solo por la clave de
--    servicio (y el dueño): ni anon ni authenticated.
-- ----------------------------------------------------------------------------

-- Distancia en línea recta (círculo máximo, fórmula de haversine) en km.
-- Radio medio terrestre 6371,0088 km. La entrada nula da nulo.
create or replace function public.avisos_zona_distancia_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select 2 * 6371.0088 * asin(least(1.0, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2))
      * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )))
$$;

-- Instante real (timestamptz) en que empieza una sesión: fecha y hora locales de Madrid.
create or replace function public.avisos_zona_inicio_sesion(p_fecha date, p_hora time)
returns timestamptz
language sql
stable
strict
set search_path = ''
as $$
  select (p_fecha + p_hora) at time zone 'Europe/Madrid'
$$;

-- ¿La sesión empieza después de p_ahora y como mucho 168 horas ABSOLUTAS después?
-- (intervalo de horas sobre timestamptz: no varía con el cambio de horario).
create or replace function public.avisos_zona_en_horizonte(
  p_fecha date, p_hora time, p_ahora timestamptz default now()
)
returns boolean
language sql
stable
strict
set search_path = ''
as $$
  select public.avisos_zona_inicio_sesion(p_fecha, p_hora) > p_ahora
     and public.avisos_zona_inicio_sesion(p_fecha, p_hora) <= p_ahora + interval '168 hours'
$$;

-- Día natural de Madrid de un instante (para la cuota diaria y el resumen).
create or replace function public.avisos_zona_dia_madrid(p_instante timestamptz)
returns date
language sql
stable
strict
set search_path = ''
as $$
  select (p_instante at time zone 'Europe/Madrid')::date
$$;

-- Instante real de las 20:30 de Madrid de un día (18:30 UTC en verano, 19:30 en invierno).
create or replace function public.avisos_zona_corte_resumen(p_dia date)
returns timestamptz
language sql
stable
strict
set search_path = ''
as $$
  select (p_dia + time '20:30') at time zone 'Europe/Madrid'
$$;

-- Ventana del resumen de un día: de las 20:30 del día anterior a las 20:30 del día.
-- (Calculada en hora local: dura 23 o 25 horas en los días de cambio de horario.)
create or replace function public.avisos_zona_ventana_resumen(p_dia date)
returns table (desde timestamptz, hasta timestamptz)
language sql
stable
strict
set search_path = ''
as $$
  select public.avisos_zona_corte_resumen(p_dia - 1),
         public.avisos_zona_corte_resumen(p_dia)
$$;

-- ¿Toca resumen ahora? Devuelve el día de Madrid del resumen si la hora local está
-- entre las 20:30 (incluida) y las 22:30 (excluida); si no, nulo. Las 22:30 son el
-- máximo de retraso admitido para recuperar una ejecución perdida.
create or replace function public.avisos_zona_dia_de_resumen(p_ahora timestamptz default now())
returns date
language sql
stable
strict
set search_path = ''
as $$
  select case
    when (p_ahora at time zone 'Europe/Madrid')::time >= time '20:30'
     and (p_ahora at time zone 'Europe/Madrid')::time <  time '22:30'
    then (p_ahora at time zone 'Europe/Madrid')::date
  end
$$;

-- ¿La hora de inicio cae en la franja del usuario? (ambos extremos incluidos)
create or replace function public.avisos_zona_en_franja(p_hora time, p_desde time, p_hasta time)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select p_hora >= p_desde and p_hora <= p_hasta
$$;

-- Interruptor: ¿se puede avisar ahora a este usuario con esta modalidad?
-- p_modo: 'inmediato' o 'resumen'. Falso si no hay fila de configuración, si el
-- interruptor está apagado o si está en modo prueba y el usuario no está en la lista.
create or replace function public.avisos_zona_habilitado(p_usuario uuid, p_modo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (case p_modo
              when 'inmediato' then c.inmediatos_activos
              when 'resumen'   then c.resumen_activo
              else false
            end)
           and (not c.solo_usuarios_prueba or p_usuario = any (c.usuarios_prueba))
      from public.config_avisos_zona c
     where c.id
  ), false)
$$;

-- Permisos de ejecución: ni público, ni anon, ni authenticated.
revoke all on function public.avisos_zona_tocar_updated_at()    from public, anon, authenticated;
revoke all on function public.avisos_zona_antes_de_guardar()    from public, anon, authenticated;
revoke all on function public.avisos_zona_distancia_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.avisos_zona_inicio_sesion(date, time)               from public, anon, authenticated;
revoke all on function public.avisos_zona_en_horizonte(date, time, timestamptz)   from public, anon, authenticated;
revoke all on function public.avisos_zona_dia_madrid(timestamptz)                 from public, anon, authenticated;
revoke all on function public.avisos_zona_corte_resumen(date)                     from public, anon, authenticated;
revoke all on function public.avisos_zona_ventana_resumen(date)                   from public, anon, authenticated;
revoke all on function public.avisos_zona_dia_de_resumen(timestamptz)             from public, anon, authenticated;
revoke all on function public.avisos_zona_en_franja(time, time, time)             from public, anon, authenticated;
revoke all on function public.avisos_zona_habilitado(uuid, text)                  from public, anon, authenticated;

grant execute on function public.avisos_zona_distancia_km(double precision, double precision, double precision, double precision) to service_role;
grant execute on function public.avisos_zona_inicio_sesion(date, time)               to service_role;
grant execute on function public.avisos_zona_en_horizonte(date, time, timestamptz)   to service_role;
grant execute on function public.avisos_zona_dia_madrid(timestamptz)                 to service_role;
grant execute on function public.avisos_zona_corte_resumen(date)                     to service_role;
grant execute on function public.avisos_zona_ventana_resumen(date)                   to service_role;
grant execute on function public.avisos_zona_dia_de_resumen(timestamptz)             to service_role;
grant execute on function public.avisos_zona_en_franja(time, time, time)             to service_role;
grant execute on function public.avisos_zona_habilitado(uuid, text)                  to service_role;

commit;
