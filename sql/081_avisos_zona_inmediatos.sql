-- ============================================================================
-- Ruleafit · 081_avisos_zona_inmediatos.sql
-- «Avisos de sesiones en mi zona» · FASE 4: notificaciones INMEDIATAS (motor).
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el SQL
-- Editor de Supabase (proyecto "ruleafit"), previa autorización expresa.
-- Este archivo NO programa ningún cron (eso es sql/081_avisos_zona_inmediatos_cron.sql,
-- que se aplica aparte y solo con el interruptor apagado) y NO activa nada.
--
-- ARQUITECTURA (sin triggers en clases y sin sistema de envío nuevo):
--   cron (cada minuto) -> procesar_avisos_zona_inmediatos()
--     -> avisos_zona_evaluar()            (Fase 3: quién cumple los filtros)
--     -> generar_aviso_zona()             (historial/campana + cola de push existente)
--     -> cola y envío push YA existentes (/api/procesar-notificaciones, sin cambios)
--
-- NO TOCA: generar_notificacion, el trigger de favoritos, reservas, cancelaciones,
-- recordatorios, la cola ni la ruta de envío. Solo escribe en notificaciones_historial
-- y notificaciones_cola (inserciones normales, tipo 'sesion_zona').
--
-- RECUPERACIÓN DE SESIONES (sin ventana de tiempo, sin pérdidas):
--   * Un CURSOR (avisos_zona_motor.cursor_at/cursor_id) marca hasta qué sesión (por
--     fecha de creación e id) ha llegado el motor. Cada ejecución procesa las
--     siguientes (hasta 50, creadas hace >= 60 s). Si el cron se para 5 horas, al
--     volver recorre todo lo publicado durante la parada (50 por minuto) y avisa de
--     lo que siga activo, sin empezar, dentro de 168 h desde su publicación y que
--     cumpla los filtros. No depende de ninguna ventana de "últimos N minutos".
--   * SIN AVISOS RETROACTIVOS: con el interruptor apagado el motor, en cada
--     ejecución, avanza el cursor SIN avisar (consume lo publicado mientras estaba
--     apagado). Al pasar de apagado a encendido, el cursor salta además hasta el
--     momento de la última modificación de config_avisos_zona (la activación) y los
--     reintentos pendientes anteriores se DESCARTAN con motivo registrado. Así, ni
--     aunque el cron estuviera parado al encender el interruptor se avisa de lo
--     publicado antes de encenderlo.
--
-- ERRORES Y REINTENTOS (nada se pierde en silencio):
--   * Fallo al avisar a UN usuario: se deshace solo su aviso (incluida su cuota del
--     día) y se anota en avisos_zona_pendientes (sesión, usuario, intentos, último
--     error, próximo intento). Los demás usuarios de la sesión no se ven afectados.
--   * Reintentos con espera creciente: 1, 2, 5, 10, 20, 30, 60 y 60 minutos
--     (8 intentos). Cada reintento vuelve a evaluar al usuario (sigue activa,
--     sin empezar, filtros, interruptor, cuota, tope). Sin duplicados: el aviso
--     reclama su cuota (usuario, organizador, día) en la misma transacción.
--   * Si se agotan los intentos el estado pasa a 'agotado': NO se borra ni se
--     descarta, queda visible (avisos_zona_estado_motor()) hasta que alguien lo
--     reintente a mano (avisos_zona_reintentar_agotados()). Los descartes por
--     motivos legítimos (ya empezó, ya no cumple, interruptor reactivado...) quedan
--     como 'descartado' con su motivo.
--   * Fallo al evaluar una SESIÓN entera: se deshace esa sesión completa, queda en
--     avisos_zona_procesadas como 'reintento' (mismos reintentos) y, si se agota,
--     como 'descartada' con el último error: también visible y reintentable.
--
-- AISLAMIENTO DEL MODO PRUEBA: generar_aviso_zona() comprueba por sí misma el
-- interruptor global y la lista de usuarios de prueba (avisos_zona_habilitado)
-- antes de escribir nada, además de la comprobación de la evaluación.
--
-- CONCURRENCIA E IDEMPOTENCIA: candado de aviso por transacción (una sola
-- ejecución a la vez); clave de sesión procesada; clave (usuario, organizador,
-- día) para el aviso; conteo del tope diario dentro de la misma transacción.
-- Ejecutarlo varias veces seguidas o a la vez no duplica avisos.
--
-- Para deshacerlo: sql/081_avisos_zona_inmediatos_reversion.sql (primero dar de baja
-- el cron con sql/081_avisos_zona_inmediatos_cron_baja.sql si se llegó a programar).
-- Comprobación posterior: sql/081_avisos_zona_inmediatos_verificacion.sql.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Estado del motor (una fila) y registro de destinatarios pendientes
-- ----------------------------------------------------------------------------
create table if not exists public.avisos_zona_motor (
  id                  boolean primary key default true check (id),   -- una única fila
  cursor_at           timestamptz not null,                           -- hasta dónde ha llegado el motor
  cursor_id           uuid not null default 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  activo_visto        boolean not null default false,                 -- ¿estaba encendido en la última ejecución?
  ultima_ejecucion_at timestamptz,
  ultima_ejecucion    jsonb,
  updated_at          timestamptz not null default now()
);

-- Al instalar, el cursor empieza AHORA: nada anterior se evaluará nunca.
insert into public.avisos_zona_motor (id, cursor_at) values (true, now()) on conflict (id) do nothing;

create table if not exists public.avisos_zona_pendientes (
  clase_id           uuid not null references public.clases(id) on delete cascade,
  usuario_id         uuid not null references auth.users(id) on delete cascade,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente', 'resuelto', 'agotado', 'descartado')),
  intentos           smallint not null default 0 check (intentos >= 0),
  ultimo_error       text check (ultimo_error is null or char_length(ultimo_error) <= 500),
  motivo             text check (motivo is null or char_length(motivo) <= 200),
  proximo_intento_at timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (clase_id, usuario_id)
);

create index if not exists avisos_zona_pendientes_due_idx
  on public.avisos_zona_pendientes (proximo_intento_at)
  where estado = 'pendiente';

alter table public.avisos_zona_motor      enable row level security;
alter table public.avisos_zona_pendientes enable row level security;
revoke all on public.avisos_zona_motor      from public, anon, authenticated;
revoke all on public.avisos_zona_pendientes from public, anon, authenticated;

comment on table public.avisos_zona_motor is
  'Estado interno del motor de avisos inmediatos: cursor de sesiones ya recorridas y si estaba encendido en la última ejecución.';
comment on table public.avisos_zona_pendientes is
  'Destinatarios de avisos inmediatos pendientes o fallidos (sesión, usuario). Nada se borra: pendiente, resuelto, agotado (visible) o descartado (con motivo).';


-- ----------------------------------------------------------------------------
-- 2) Texto del aviso: «Título · Ciudad · sáb 5 dic, 18:00 (de @organizador)»
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_texto_cuerpo(
  p_titulo text, p_ciudad text, p_fecha date, p_hora time, p_username text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(coalesce(p_titulo, '')), 80)
      || ' · ' || btrim(coalesce(p_ciudad, ''))
      || ' · ' || (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from p_fecha)::int + 1]
      || ' ' || extract(day from p_fecha)::int::text
      || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from p_fecha)::int]
      || ', ' || to_char(p_hora, 'HH24:MI')
      || ' (de @' || coalesce(p_username, 'organizador') || ')'
$$;


-- ----------------------------------------------------------------------------
-- 3) generar_aviso_zona: UN aviso a UN usuario, de forma atómica
--    Devuelve: 'enviado' | 'no_habilitado' | 'sin_configuracion' | 'sesion_no_valida'
--              | 'ya_avisado_organizador' | 'tope_diario'.
--    Solo las excepciones reales (fallo al escribir...) se propagan: el llamador
--    las anota como pendientes. Todo lo escrito aquí se deshace si falla algo.
-- ----------------------------------------------------------------------------
create or replace function public.generar_aviso_zona(
  p_usuario_id uuid,
  p_clase_id   uuid,
  p_ahora      timestamptz default now()
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_clase    record;
  v_username text;
  v_dia      date;
  v_tope     integer;
  v_usados   integer;
  v_n        integer;
  v_cuerpo   text;
  v_url      text;
begin
  -- 1) AISLAMIENTO: interruptor global y modo prueba, comprobados AQUÍ además de en
  --    la evaluación. Sin esto no se escribe nada (ni campana ni push).
  if not public.avisos_zona_habilitado(p_usuario_id, 'inmediato') then
    return 'no_habilitado';
  end if;

  -- 2) Configuración vigente del usuario.
  if not exists (select 1 from public.avisos_zona a
                  where a.usuario_id = p_usuario_id and a.activo and a.modo = 'inmediato') then
    return 'sin_configuracion';
  end if;

  -- 3) La sesión sigue activa, sin empezar y no es del propio usuario.
  select c.id, c.trainer_id, c.titulo, c.ciudad, c.fecha, c.hora, c.estado, c.created_at
    into v_clase
    from public.clases c
   where c.id = p_clase_id;
  if not found
     or v_clase.estado <> 'activa'
     or v_clase.trainer_id = p_usuario_id
     or public.avisos_zona_inicio_sesion(v_clase.fecha, v_clase.hora) <= p_ahora then
    return 'sesion_no_valida';
  end if;

  v_dia := public.avisos_zona_dia_madrid(v_clase.created_at);

  -- 4) Un aviso por usuario, organizador y día: se RECLAMA la cuota (clave primaria).
  insert into public.avisos_zona_inmediatos (usuario_id, organizador_id, dia, clase_id)
  values (p_usuario_id, v_clase.trainer_id, v_dia, p_clase_id)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return 'ya_avisado_organizador';
  end if;

  -- 5) Tope de avisos inmediatos por usuario y día (la fila recién reclamada cuenta).
  select cfg.tope_inmediatos_usuario_dia into v_tope
    from public.config_avisos_zona cfg where cfg.id;
  select count(*) into v_usados
    from public.avisos_zona_inmediatos i
   where i.usuario_id = p_usuario_id and i.dia = v_dia;
  if v_usados > coalesce(v_tope, 5) then
    delete from public.avisos_zona_inmediatos
     where usuario_id = p_usuario_id and organizador_id = v_clase.trainer_id and dia = v_dia;
    return 'tope_diario';
  end if;

  -- 6) Notificación: campana (historial) siempre; push solo si hay suscripción.
  select p.username into v_username from public.perfiles p where p.id = v_clase.trainer_id;
  v_cuerpo := public.avisos_zona_texto_cuerpo(v_clase.titulo, v_clase.ciudad, v_clase.fecha, v_clase.hora, v_username);
  v_url := '/clases/' || p_clase_id::text;

  insert into public.notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
  values (p_usuario_id, 'sesion_zona', 'Nueva sesión cerca de ti', v_cuerpo, v_url);

  if exists (select 1 from public.push_subscriptions s where s.usuario_id = p_usuario_id) then
    insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, 'sesion_zona', 'Nueva sesión cerca de ti', v_cuerpo, v_url);
  end if;

  return 'enviado';
end;
$$;


-- ----------------------------------------------------------------------------
-- 4) avisos_zona_procesar_sesion: evalúa UNA sesión y avisa a sus destinatarios
--    (interna). Un fallo con un usuario no afecta a los demás: se anota pendiente.
--    Devuelve contadores. Si lanza excepción, el llamador deshace la sesión entera.
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_procesar_sesion(
  p_clase_id uuid,
  p_ahora    timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r          record;
  v_estado   text;
  v_enviados integer := 0;
  v_omitidos integer := 0;
  v_pend     integer := 0;
begin
  for r in
    select e.usuario_id
      from public.avisos_zona_evaluar(p_clase_id, p_ahora, false) e
     where e.modo = 'inmediato' and e.habilitado
     order by e.usuario_id
  loop
    begin
      v_estado := public.generar_aviso_zona(r.usuario_id, p_clase_id, p_ahora);
      if v_estado = 'enviado' then
        v_enviados := v_enviados + 1;
      else
        v_omitidos := v_omitidos + 1;
      end if;
    exception when others then
      -- Se deshace solo el aviso de este usuario (y su cuota) y se anota.
      insert into public.avisos_zona_pendientes
        (clase_id, usuario_id, estado, intentos, ultimo_error, proximo_intento_at, updated_at)
      values
        (p_clase_id, r.usuario_id, 'pendiente', 1, left(sqlerrm, 500), p_ahora + interval '1 minute', p_ahora)
      on conflict (clase_id, usuario_id) do update
        set estado = 'pendiente',
            intentos = public.avisos_zona_pendientes.intentos + 1,
            ultimo_error = excluded.ultimo_error,
            proximo_intento_at = excluded.proximo_intento_at,
            updated_at = excluded.updated_at;
      v_pend := v_pend + 1;
    end;
  end loop;

  return jsonb_build_object('enviados', v_enviados, 'omitidos', v_omitidos, 'pendientes', v_pend);
end;
$$;


-- ----------------------------------------------------------------------------
-- 5) procesar_avisos_zona_inmediatos: el motor (lo llamará el cron cada minuto)
-- ----------------------------------------------------------------------------
create or replace function public.procesar_avisos_zona_inmediatos(
  p_ahora timestamptz default now()
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_espera   constant integer[] := array[1, 2, 5, 10, 20, 30, 60, 60];  -- minutos entre reintentos
  v_max      constant integer   := 8;                                    -- intentos máximos
  v_cfg      public.config_avisos_zona%rowtype;
  v_mot      public.avisos_zona_motor%rowtype;
  v_nuevo    timestamptz;
  v_ult_at   timestamptz;
  v_ult_id   uuid;
  v_c        record;
  v_p        record;
  v_ev       record;
  v_out      jsonb;
  v_n        integer;
  v_st       text;
  v_nuevo_estado text;
  v_motivo   text;
  v_error    text;
  v_intentos integer;
  v_sesiones integer := 0;
  v_enviados integer := 0;
  v_omitidos integer := 0;
  v_pend_nuevos integer := 0;
  v_reint_ok integer := 0;
  v_reint_fallo integer := 0;
  v_reint_desc integer := 0;
  v_ses_fallo integer := 0;
  v_resultado jsonb;
begin
  -- Una sola ejecución a la vez (el candado se libera al terminar la transacción).
  if not pg_try_advisory_xact_lock(hashtext('avisos_zona_inmediatos')::bigint) then
    return jsonb_build_object('estado', 'ocupado');
  end if;

  select * into v_cfg from public.config_avisos_zona where id;
  select * into v_mot from public.avisos_zona_motor where id for update;
  if not found then
    raise exception 'Falta la fila de avisos_zona_motor';
  end if;

  -- A) APAGADO: no se avisa a nadie. Se consume lo publicado (sin avisos retroactivos
  --    al encender) avanzando el cursor hasta hace 60 s.
  if not coalesce(v_cfg.inmediatos_activos, false) then
    v_nuevo := greatest(v_mot.cursor_at, p_ahora - interval '60 seconds');
    v_resultado := jsonb_build_object('estado', 'apagado');
    update public.avisos_zona_motor
       set activo_visto = false,
           cursor_at = v_nuevo,
           cursor_id = case when v_nuevo > v_mot.cursor_at
                            then 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid else v_mot.cursor_id end,
           ultima_ejecucion_at = p_ahora,
           ultima_ejecucion = v_resultado,
           updated_at = p_ahora
     where id;
    return v_resultado;
  end if;

  -- B) TRANSICIÓN apagado -> encendido: nada de lo anterior a la activación.
  if not v_mot.activo_visto then
    v_nuevo := greatest(v_mot.cursor_at, v_cfg.updated_at);
    update public.avisos_zona_motor
       set cursor_at = v_nuevo,
           cursor_id = case when v_nuevo > v_mot.cursor_at
                            then 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid else v_mot.cursor_id end,
           activo_visto = true,
           updated_at = p_ahora
     where id;
    update public.avisos_zona_pendientes
       set estado = 'descartado',
           motivo = 'interruptor reactivado: sin avisos retroactivos',
           updated_at = p_ahora
     where estado = 'pendiente';
    update public.avisos_zona_procesadas
       set estado = 'descartada',
           ultimo_error = coalesce(left(ultimo_error, 400), '') || ' | descartada: interruptor reactivado',
           actualizada_at = p_ahora
     where estado = 'reintento';
    select * into v_mot from public.avisos_zona_motor where id;
  elsif v_cfg.updated_at > coalesce(v_mot.ultima_ejecucion_at, '-infinity'::timestamptz) then
    -- La configuración global cambió desde la última ejecución (por ejemplo, un apagado
    -- y un encendido sin ninguna ejecución entre medias, con el cron parado): no se
    -- puede saber si se reactivó, así que por prudencia se corta como en una
    -- reactivación. Solo mueve el cursor; los reintentos pendientes se conservan.
    -- Coste: las sesiones creadas justo antes del cambio (como mucho ~90 s con el cron
    -- sano) no se avisan. Es una edición manual poco frecuente.
    v_nuevo := greatest(v_mot.cursor_at, v_cfg.updated_at);
    if v_nuevo > v_mot.cursor_at then
      update public.avisos_zona_motor
         set cursor_at = v_nuevo,
             cursor_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
             updated_at = p_ahora
       where id;
      select * into v_mot from public.avisos_zona_motor where id;
    end if;
  end if;

  -- C) REINTENTOS de destinatarios pendientes (hasta 100 por ejecución).
  for v_p in
    select * from public.avisos_zona_pendientes
     where estado = 'pendiente' and proximo_intento_at <= p_ahora
     order by proximo_intento_at, clase_id, usuario_id
     limit 100
     for update skip locked
  loop
    v_nuevo_estado := null; v_motivo := null; v_error := null;
    begin
      select e.resultado, e.habilitado into v_ev
        from public.avisos_zona_evaluar(v_p.clase_id, p_ahora, true) e
       where e.usuario_id = v_p.usuario_id;
      if not found then
        v_nuevo_estado := 'descartado'; v_motivo := 'sin_configuracion';
      elsif v_ev.resultado <> 'recibe' then
        v_nuevo_estado := 'descartado'; v_motivo := v_ev.resultado;
      elsif not v_ev.habilitado then
        v_nuevo_estado := 'descartado'; v_motivo := 'no_habilitado';
      else
        v_st := public.generar_aviso_zona(v_p.usuario_id, v_p.clase_id, p_ahora);
        if v_st = 'enviado' then
          v_nuevo_estado := 'resuelto';
        else
          v_nuevo_estado := 'descartado'; v_motivo := v_st;
        end if;
      end if;
    exception when others then
      v_error := left(sqlerrm, 500);
    end;

    if v_error is not null then
      v_intentos := v_p.intentos + 1;
      if v_intentos >= v_max then
        update public.avisos_zona_pendientes
           set estado = 'agotado', intentos = v_intentos, ultimo_error = v_error,
               motivo = 'intentos agotados: requiere revisión', updated_at = p_ahora
         where clase_id = v_p.clase_id and usuario_id = v_p.usuario_id;
        raise warning 'avisos_zona: aviso AGOTADO (clase %, usuario %): %', v_p.clase_id, v_p.usuario_id, v_error;
      else
        update public.avisos_zona_pendientes
           set intentos = v_intentos, ultimo_error = v_error,
               proximo_intento_at = p_ahora + make_interval(mins => v_espera[v_intentos]),
               updated_at = p_ahora
         where clase_id = v_p.clase_id and usuario_id = v_p.usuario_id;
      end if;
      v_reint_fallo := v_reint_fallo + 1;
    else
      update public.avisos_zona_pendientes
         set estado = v_nuevo_estado, motivo = v_motivo, ultimo_error = null,
             intentos = v_p.intentos + 1, updated_at = p_ahora
       where clase_id = v_p.clase_id and usuario_id = v_p.usuario_id;
      if v_nuevo_estado = 'resuelto' then
        v_reint_ok := v_reint_ok + 1; v_enviados := v_enviados + 1;
      else
        v_reint_desc := v_reint_desc + 1;
      end if;
    end if;
  end loop;

  -- D) REINTENTOS de sesiones cuya evaluación falló entera (hasta 20 por ejecución).
  for v_c in
    select pr.clase_id, pr.intentos
      from public.avisos_zona_procesadas pr
     where pr.estado = 'reintento'
       and pr.actualizada_at + make_interval(mins => v_espera[least(greatest(pr.intentos, 1), v_max)]) <= p_ahora
     order by pr.creada_at, pr.clase_id
     limit 20
  loop
    begin
      v_out := public.avisos_zona_procesar_sesion(v_c.clase_id, p_ahora);
      update public.avisos_zona_procesadas
         set estado = 'procesada', ultimo_error = null, actualizada_at = p_ahora
       where clase_id = v_c.clase_id;
      v_sesiones := v_sesiones + 1;
      v_enviados := v_enviados + (v_out->>'enviados')::int;
      v_omitidos := v_omitidos + (v_out->>'omitidos')::int;
      v_pend_nuevos := v_pend_nuevos + (v_out->>'pendientes')::int;
    exception when others then
      v_error := left(sqlerrm, 500);
      v_intentos := v_c.intentos + 1;
      if v_intentos >= v_max then
        update public.avisos_zona_procesadas
           set estado = 'descartada', intentos = v_intentos, ultimo_error = v_error, actualizada_at = p_ahora
         where clase_id = v_c.clase_id;
        raise warning 'avisos_zona: sesión AGOTADA (clase %): %', v_c.clase_id, v_error;
      else
        update public.avisos_zona_procesadas
           set intentos = v_intentos, ultimo_error = v_error, actualizada_at = p_ahora
         where clase_id = v_c.clase_id;
      end if;
      v_ses_fallo := v_ses_fallo + 1;
    end;
  end loop;

  -- E) SESIONES NUEVAS desde el cursor (hasta 50, creadas hace >= 60 s), por orden de
  --    creación; dentro del lote, por organizador y hora de comienzo (el aviso del día
  --    de un organizador va a la sesión que empieza antes).
  v_ult_at := v_mot.cursor_at;
  v_ult_id := v_mot.cursor_id;
  for v_c in
    with lote as (
      select c.id, c.created_at, c.trainer_id,
             public.avisos_zona_inicio_sesion(c.fecha, c.hora) as inicio
        from public.clases c
       where (c.created_at, c.id) > (v_mot.cursor_at, v_mot.cursor_id)
         and c.created_at <= p_ahora - interval '60 seconds'
       order by c.created_at, c.id
       limit 50
    )
    select * from lote order by trainer_id, inicio, id
  loop
    if (v_c.created_at, v_c.id) > (v_ult_at, v_ult_id) then
      v_ult_at := v_c.created_at;
      v_ult_id := v_c.id;
    end if;

    -- Reclamar la sesión (clave primaria): si ya estaba procesada, no se repite.
    insert into public.avisos_zona_procesadas (clase_id, estado, intentos, actualizada_at)
    values (v_c.id, 'procesada', 0, p_ahora)
    on conflict do nothing;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      continue;
    end if;

    begin
      v_out := public.avisos_zona_procesar_sesion(v_c.id, p_ahora);
      v_sesiones := v_sesiones + 1;
      v_enviados := v_enviados + (v_out->>'enviados')::int;
      v_omitidos := v_omitidos + (v_out->>'omitidos')::int;
      v_pend_nuevos := v_pend_nuevos + (v_out->>'pendientes')::int;
    exception when others then
      -- Se deshace la sesión entera; queda registrada para reintentarla.
      update public.avisos_zona_procesadas
         set estado = 'reintento', intentos = 1, ultimo_error = left(sqlerrm, 500), actualizada_at = p_ahora
       where clase_id = v_c.id;
      v_ses_fallo := v_ses_fallo + 1;
    end;
  end loop;

  -- El cursor avanza hasta la última sesión recorrida del lote.
  v_resultado := jsonb_build_object(
    'estado', 'ok',
    'sesiones', v_sesiones,
    'avisos_enviados', v_enviados,
    'omitidos', v_omitidos,
    'pendientes_nuevos', v_pend_nuevos,
    'reintentos_resueltos', v_reint_ok,
    'reintentos_fallidos', v_reint_fallo,
    'reintentos_descartados', v_reint_desc,
    'sesiones_con_error', v_ses_fallo
  );
  update public.avisos_zona_motor
     set cursor_at = v_ult_at, cursor_id = v_ult_id,
         ultima_ejecucion_at = p_ahora, ultima_ejecucion = v_resultado, updated_at = p_ahora
   where id;

  return v_resultado;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) Diagnóstico (solo lectura) y reintento manual de lo agotado
-- ----------------------------------------------------------------------------
create or replace function public.avisos_zona_estado_motor()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'motor', (select to_jsonb(m) from public.avisos_zona_motor m where m.id),
    'pendientes_por_estado', coalesce((select jsonb_object_agg(estado, n)
        from (select estado, count(*) n from public.avisos_zona_pendientes group by estado) t), '{}'::jsonb),
    'sesiones_por_estado', coalesce((select jsonb_object_agg(estado, n)
        from (select estado, count(*) n from public.avisos_zona_procesadas group by estado) t), '{}'::jsonb),
    'agotados', coalesce((select jsonb_agg(jsonb_build_object('clase_id', clase_id, 'usuario_id', usuario_id,
                                                             'intentos', intentos, 'ultimo_error', ultimo_error))
        from (select * from public.avisos_zona_pendientes where estado = 'agotado' order by updated_at limit 50) a), '[]'::jsonb),
    'sesiones_descartadas', coalesce((select jsonb_agg(jsonb_build_object('clase_id', clase_id, 'intentos', intentos, 'ultimo_error', ultimo_error))
        from (select * from public.avisos_zona_procesadas where estado = 'descartada' order by actualizada_at limit 50) d), '[]'::jsonb)
  )
$$;

-- Devuelve cuántos elementos agotados vuelve a poner en cola de reintento (0 = ninguno).
create or replace function public.avisos_zona_reintentar_agotados(p_clase_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_a integer;
  v_b integer;
begin
  update public.avisos_zona_pendientes
     set estado = 'pendiente', intentos = 0, motivo = null, proximo_intento_at = now(), updated_at = now()
   where estado = 'agotado' and (p_clase_id is null or clase_id = p_clase_id);
  get diagnostics v_a = row_count;
  update public.avisos_zona_procesadas
     set estado = 'reintento', intentos = 1, actualizada_at = now() - interval '1 day'
   where estado = 'descartada' and (p_clase_id is null or clase_id = p_clase_id);
  get diagnostics v_b = row_count;
  return v_a + v_b;
end;
$$;


-- ----------------------------------------------------------------------------
-- 7) Permisos: solo la clave de servicio (y el dueño: el cron corre como postgres)
-- ----------------------------------------------------------------------------
revoke all on function public.avisos_zona_texto_cuerpo(text, text, date, time, text)      from public, anon, authenticated;
revoke all on function public.generar_aviso_zona(uuid, uuid, timestamptz)                 from public, anon, authenticated;
revoke all on function public.avisos_zona_procesar_sesion(uuid, timestamptz)              from public, anon, authenticated;
revoke all on function public.procesar_avisos_zona_inmediatos(timestamptz)                from public, anon, authenticated;
revoke all on function public.avisos_zona_estado_motor()                                  from public, anon, authenticated;
revoke all on function public.avisos_zona_reintentar_agotados(uuid)                       from public, anon, authenticated;

grant execute on function public.avisos_zona_texto_cuerpo(text, text, date, time, text)   to service_role;
grant execute on function public.generar_aviso_zona(uuid, uuid, timestamptz)              to service_role;
grant execute on function public.avisos_zona_procesar_sesion(uuid, timestamptz)           to service_role;
grant execute on function public.procesar_avisos_zona_inmediatos(timestamptz)             to service_role;
grant execute on function public.avisos_zona_estado_motor()                               to service_role;
grant execute on function public.avisos_zona_reintentar_agotados(uuid)                    to service_role;

commit;
