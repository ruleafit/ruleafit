-- ============================================================================
-- Ruleafit · 082_avisos_zona_resumen.sql
-- «Avisos de sesiones en mi zona» · FASE 5: RESUMEN DIARIO (20:30 Europe/Madrid).
--
-- NO EJECUTADO todavía. Aplicar solo con autorización expresa, DESPUÉS de las
-- fases 1, 3 y 4 (sql/079, 080 y 081). Con los interruptores apagados no avisa a nadie.
--
-- QUÉ HACE
--   Cada día, a partir de las 20:30 de Madrid, cada usuario con avisos activados en
--   modalidad «diario» recibe UNA notificación (campana siempre; push solo si tiene
--   suscripción) con el número de sesiones nuevas que encajan con sus filtros, y un
--   enlace /sesiones-en-mi-zona?r=<id> a la pantalla con esas mismas sesiones.
--   Si no hay ninguna, no se avisa. Se reutiliza el sistema de campana y cola de push
--   (inserciones normales en notificaciones_historial / notificaciones_cola, tipo
--   'resumen_zona'); no se envía nada por otra vía.
--
-- REGLAS (misma lógica que avisos_zona_evaluar, aplicada a una ventana)
--   · Ventana del día D: sesiones PUBLICADAS entre las 20:30 de D-1 y las 20:30 de D
--     (hora de Madrid; dura 23 o 25 h al cambiar el horario). Se mide con created_at.
--   · Solo sesiones que empiezan dentro de las 168 horas reales posteriores a su
--     publicación, activas, sin empezar y con plazas libres EN EL MOMENTO del resumen.
--   · Excluye: propias, bloqueos en cualquier sentido, publicadas antes de activar
--     (activo_desde), categoría/franja/radio fuera de lo elegido, y organizadores que
--     el usuario tiene en favoritos con la preferencia «publicaciones» activa (ya los
--     avisa el trigger de favoritos).
--   · Sin duplicados: no incluye sesiones ya avisadas como inmediatas ni ya contenidas
--     en un resumen anterior del usuario. Un resumen por usuario y día (unique).
--   · Independiente de la modalidad inmediata: solo usuarios con modo = 'diario' y el
--     interruptor resumen_activo (y modo prueba) de config_avisos_zona.
--
-- RECUPERACIÓN: el cron se lanza cada 5 min (18:00-21:55 UTC, ver el archivo _cron).
--   La función solo actúa si la hora de Madrid está entre las 20:30 y las 22:30; si el
--   cron falla un rato dentro de esa franja, la siguiente ejecución envía los resúmenes
--   que falten (idempotente). Pasadas las 22:30 ya no se envía el resumen de ese día
--   (para no entregar un aviso tardío); la ventana de mañana no lo arrastra.
--
-- NO TOCA generar_notificacion, el trigger de favoritos, la cola, la ruta de envío,
-- reservas, cancelaciones ni recordatorios. No crea triggers ni cron (el cron va en
-- sql/082_avisos_zona_resumen_cron.sql, aparte).
-- Reversión: sql/082_avisos_zona_resumen_reversion.sql · Verificación: _verificacion.sql
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Estado del proceso y registro de errores (control interno, sin acceso web)
-- ----------------------------------------------------------------------------
create table if not exists public.avisos_zona_resumen_motor (
  id                  boolean primary key default true check (id),   -- una única fila
  ultima_ejecucion_at timestamptz,
  ultima_ejecucion    jsonb
);
insert into public.avisos_zona_resumen_motor (id) values (true) on conflict (id) do nothing;

create table if not exists public.avisos_zona_resumen_errores (
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  dia          date not null,
  intentos     smallint not null default 1,
  ultimo_error text check (ultimo_error is null or char_length(ultimo_error) <= 500),
  updated_at   timestamptz not null default now(),
  primary key (usuario_id, dia)
);

alter table public.avisos_zona_resumen_motor   enable row level security;
alter table public.avisos_zona_resumen_errores enable row level security;
revoke all on public.avisos_zona_resumen_motor   from public, anon, authenticated;
revoke all on public.avisos_zona_resumen_errores from public, anon, authenticated;

comment on table public.avisos_zona_resumen_motor is
  'Estado interno del proceso del resumen diario: resultado de la última ejecución.';
comment on table public.avisos_zona_resumen_errores is
  'Fallos al generar el resumen de un usuario en un día (se reintentan en la ejecución siguiente dentro de la franja).';


-- ----------------------------------------------------------------------------
-- 2) Sesiones que entran en el resumen de un usuario (solo lectura)
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_sesiones_resumen(
  p_usuario uuid,
  p_dia     date,
  p_ahora   timestamptz default now()
)
returns table (clase_id uuid, organizador_id uuid, inicio timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         c.trainer_id,
         public.avisos_zona_inicio_sesion(c.fecha, c.hora)
    from public.avisos_zona a
    cross join public.avisos_zona_ventana_resumen(p_dia) v
    join public.clases c
      on c.created_at >= v.desde and c.created_at < v.hasta
   where a.usuario_id = p_usuario
     and a.activo
     and a.modo = 'diario'
     and c.estado = 'activa'
     and public.avisos_zona_inicio_sesion(c.fecha, c.hora) > p_ahora
     and public.avisos_zona_inicio_sesion(c.fecha, c.hora) <= c.created_at + interval '168 hours'
     and c.plazas_ocupadas < c.plazas_max
     and c.lat is not null and c.lng is not null
     and c.created_at >= a.activo_desde
     and c.trainer_id <> a.usuario_id
     and not exists (
           select 1 from public.bloqueos b
            where (b.bloqueador_id = a.usuario_id and b.bloqueado_id = c.trainer_id)
               or (b.bloqueador_id = c.trainer_id and b.bloqueado_id = a.usuario_id))
     and c.categoria = any (a.categorias)
     and public.avisos_zona_en_franja(c.hora, a.hora_desde, a.hora_hasta)
     and public.avisos_zona_distancia_km(a.zona_lat, a.zona_lng, c.lat, c.lng) <= a.radio_km
     -- Ya los avisa el trigger de favoritos (misma condición que sql/078).
     and not exists (
           select 1 from public.favoritos f
            where f.usuario_id = a.usuario_id
              and f.favorito_id = c.trainer_id
              and coalesce((select pn.activo
                              from public.preferencias_notificaciones pn
                             where pn.usuario_id = f.usuario_id
                               and pn.categoria = 'publicaciones'), true))
     -- Sin duplicados con avisos inmediatos ni con resúmenes anteriores.
     and not exists (
           select 1 from public.avisos_zona_inmediatos i
            where i.usuario_id = a.usuario_id and i.clase_id = c.id)
     and not exists (
           select 1 from public.avisos_zona_resumenes r
            where r.usuario_id = a.usuario_id and c.id = any (r.clases_ids))
   order by 3, c.id
$$;


-- ----------------------------------------------------------------------------
-- 3) generar_resumen_zona: el resumen de UN usuario (idempotente)
--    Devuelve: 'enviado' | 'fuera_de_hora' | 'no_habilitado' | 'sin_configuracion'
--              | 'ya_enviado' | 'sin_sesiones'.
--    Todo lo escrito aquí es atómico: si algo falla, no queda ni el resumen ni la
--    notificación a medias (y el llamador lo reintenta en la siguiente ejecución).
-- ----------------------------------------------------------------------------
create or replace function public.generar_resumen_zona(
  p_usuario_id uuid,
  p_dia        date,
  p_ahora      timestamptz default now()
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids    uuid[];
  v_org    integer;
  v_n      integer;
  v_desde  timestamptz;
  v_hasta  timestamptz;
  v_id     uuid;
  v_cuerpo text;
  v_url    text;
begin
  -- Solo se genera el resumen del día en curso, dentro de la franja 20:30-22:30.
  if p_dia is distinct from public.avisos_zona_dia_de_resumen(p_ahora) then
    return 'fuera_de_hora';
  end if;

  -- AISLAMIENTO: interruptor global y modo prueba, comprobados AQUÍ también.
  if not public.avisos_zona_habilitado(p_usuario_id, 'resumen') then
    return 'no_habilitado';
  end if;

  if not exists (select 1 from public.avisos_zona a
                  where a.usuario_id = p_usuario_id and a.activo and a.modo = 'diario') then
    return 'sin_configuracion';
  end if;

  if exists (select 1 from public.avisos_zona_resumenes r
              where r.usuario_id = p_usuario_id and r.dia = p_dia) then
    return 'ya_enviado';
  end if;

  select array_agg(s.clase_id order by s.inicio, s.clase_id),
         count(distinct s.organizador_id)
    into v_ids, v_org
    from (select * from public.avisos_zona_sesiones_resumen(p_usuario_id, p_dia, p_ahora) limit 500) s;
  if v_ids is null then
    return 'sin_sesiones';
  end if;
  v_n := cardinality(v_ids);

  select v.desde, v.hasta into v_desde, v_hasta from public.avisos_zona_ventana_resumen(p_dia) v;

  -- Se RECLAMA el día (clave única usuario+día): un solo resumen aunque haya
  -- ejecuciones simultáneas o repetidas.
  insert into public.avisos_zona_resumenes
    (usuario_id, dia, ventana_desde, ventana_hasta, clases_ids, total_sesiones, total_organizadores)
  values (p_usuario_id, p_dia, v_desde, v_hasta, v_ids, v_n, v_org)
  on conflict (usuario_id, dia) do nothing
  returning id into v_id;
  if v_id is null then
    return 'ya_enviado';
  end if;

  v_cuerpo := case when v_n = 1
                then '1 sesión nueva en tu zona. Toca para verla.'
                else v_n::text || ' sesiones nuevas en tu zona'
                     || case when v_org > 1 then ' (' || v_org::text || ' organizadores)' else '' end
                     || '. Toca para verlas.'
              end;
  v_url := '/sesiones-en-mi-zona?r=' || v_id::text;

  -- Campana siempre; push solo si hay suscripción (mismas tablas que el resto).
  insert into public.notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
  values (p_usuario_id, 'resumen_zona', 'Nuevas sesiones cerca de ti', v_cuerpo, v_url);

  if exists (select 1 from public.push_subscriptions s where s.usuario_id = p_usuario_id) then
    insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, 'resumen_zona', 'Nuevas sesiones cerca de ti', v_cuerpo, v_url);
  end if;

  return 'enviado';
end;
$$;


-- ----------------------------------------------------------------------------
-- 4) procesar_avisos_zona_resumen: lo que ejecuta el cron
-- ----------------------------------------------------------------------------
create or replace function public.procesar_avisos_zona_resumen(
  p_ahora timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_dia      date;
  v_res      jsonb;
  r          record;
  v_estado   text;
  v_enviados integer := 0;
  v_omitidos integer := 0;
  v_errores  integer := 0;
  v_ventana  record;
begin
  v_dia := public.avisos_zona_dia_de_resumen(p_ahora);
  if v_dia is null then
    return jsonb_build_object('estado', 'fuera_de_hora');      -- sin escribir nada
  end if;

  -- Una sola ejecución a la vez.
  if not pg_try_advisory_xact_lock(hashtext('avisos_zona_resumen')) then
    return jsonb_build_object('estado', 'ocupado');
  end if;

  if not exists (select 1 from public.config_avisos_zona c where c.resumen_activo) then
    v_res := jsonb_build_object('estado', 'apagado', 'dia', v_dia);
    update public.avisos_zona_resumen_motor set ultima_ejecucion_at = p_ahora, ultima_ejecucion = v_res;
    return v_res;
  end if;

  select v.desde, v.hasta into v_ventana from public.avisos_zona_ventana_resumen(v_dia) v;
  -- Sin sesiones publicadas en la ventana no hay nada que resumir.
  if not exists (select 1 from public.clases c
                  where c.created_at >= v_ventana.desde and c.created_at < v_ventana.hasta) then
    v_res := jsonb_build_object('estado', 'sin_sesiones_en_ventana', 'dia', v_dia);
    update public.avisos_zona_resumen_motor set ultima_ejecucion_at = p_ahora, ultima_ejecucion = v_res;
    return v_res;
  end if;

  for r in
    select a.usuario_id
      from public.avisos_zona a
     where a.activo and a.modo = 'diario'
       and not exists (select 1 from public.avisos_zona_resumenes x
                        where x.usuario_id = a.usuario_id and x.dia = v_dia)
     order by a.usuario_id
     limit 2000
  loop
    begin
      v_estado := public.generar_resumen_zona(r.usuario_id, v_dia, p_ahora);
      if v_estado = 'enviado' then
        v_enviados := v_enviados + 1;
        delete from public.avisos_zona_resumen_errores e where e.usuario_id = r.usuario_id and e.dia = v_dia;
      else
        v_omitidos := v_omitidos + 1;
      end if;
    exception when others then
      -- Se deshace solo el resumen de este usuario; se anota y se reintenta luego.
      insert into public.avisos_zona_resumen_errores (usuario_id, dia, intentos, ultimo_error, updated_at)
      values (r.usuario_id, v_dia, 1, left(sqlerrm, 500), p_ahora)
      on conflict (usuario_id, dia) do update
        set intentos = public.avisos_zona_resumen_errores.intentos + 1,
            ultimo_error = excluded.ultimo_error,
            updated_at = excluded.updated_at;
      v_errores := v_errores + 1;
    end;
  end loop;

  v_res := jsonb_build_object('estado', 'ok', 'dia', v_dia, 'resumenes_enviados', v_enviados,
                              'omitidos', v_omitidos, 'errores', v_errores);
  update public.avisos_zona_resumen_motor set ultima_ejecucion_at = p_ahora, ultima_ejecucion = v_res;
  return v_res;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5) Diagnóstico (solo lectura)
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_estado_resumen()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'motor', (select to_jsonb(m) from public.avisos_zona_resumen_motor m),
    'resumenes_hoy', (select count(*) from public.avisos_zona_resumenes r
                       where r.dia = public.avisos_zona_dia_madrid(now())),
    'errores_sin_resolver', (select count(*) from public.avisos_zona_resumen_errores e
                              where e.dia >= public.avisos_zona_dia_madrid(now()) - 1)
  )
$$;


-- ----------------------------------------------------------------------------
-- 6) Permisos: solo la clave de servicio. Ni público, ni anon, ni authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.avisos_zona_sesiones_resumen(uuid, date, timestamptz) from public, anon, authenticated;
revoke all on function public.generar_resumen_zona(uuid, date, timestamptz)         from public, anon, authenticated;
revoke all on function public.procesar_avisos_zona_resumen(timestamptz)             from public, anon, authenticated;
revoke all on function public.avisos_zona_estado_resumen()                          from public, anon, authenticated;

grant execute on function public.avisos_zona_sesiones_resumen(uuid, date, timestamptz) to service_role;
grant execute on function public.generar_resumen_zona(uuid, date, timestamptz)         to service_role;
grant execute on function public.procesar_avisos_zona_resumen(timestamptz)             to service_role;
grant execute on function public.avisos_zona_estado_resumen()                          to service_role;

commit;
