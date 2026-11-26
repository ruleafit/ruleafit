-- ============================================================================
-- Ruleafit · 099_alertas_operativas.sql
-- Pendiente 36: alertas operativas (webhooks, devoluciones, liberación de saldos, crons y cola de
-- notificaciones) y PARADA SEGURA. Requiere sql/071, 072 (096 y 098 son opcionales: si existen, se vigilan).
-- No activa pagos.
--
-- PARADA SEGURA: dos frenos independientes de config_pagos.pagos_activos:
--   · parada_cobros        no se pueden iniciar cobros nuevos (trigger en cobros).
--   · parada_devoluciones  /api/payments/devolver no pide nada más al banco.
-- No se usa pagos_activos como freno A PROPÓSITO: con pagos_activos=false las sesiones de pago se reservan
-- sin pagar (sql/073). Las confirmaciones del banco de pagos ya hechos NUNCA se paran.
-- Los frenos se activan solos ante fallos críticos y SOLO se quitan a mano (reanudar_pagos).
--
-- Todo es solo para el servicio (service_role). Reversión: sql/099_alertas_operativas_reversion.sql
-- ============================================================================

alter table public.config_pagos
  add column if not exists parada_cobros       boolean not null default false,
  add column if not exists parada_devoluciones boolean not null default false,
  add column if not exists parada_motivo       text,
  add column if not exists parada_en           timestamptz;

create table if not exists public.alertas_operativas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('webhook', 'devoluciones', 'liquidaciones', 'cron', 'cola', 'incidencias', 'parada')),
  clave       text not null,
  gravedad    text not null check (gravedad in ('aviso', 'critica')),
  detalle     text not null,
  veces       integer not null default 1,
  primera_en  timestamptz not null default now(),
  ultima_en   timestamptz not null default now(),
  avisada_en  timestamptz,
  resuelta_en timestamptz
);
-- Una sola alerta ABIERTA por clave: las repeticiones suman, no multiplican correos.
create unique index if not exists alertas_operativas_abierta on public.alertas_operativas (clave) where resuelta_en is null;
create index if not exists alertas_operativas_recientes on public.alertas_operativas (ultima_en desc);

alter table public.alertas_operativas enable row level security;
revoke all on public.alertas_operativas from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Frenos
-- ----------------------------------------------------------------------------
create or replace function public.estado_paradas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('cobros', parada_cobros, 'devoluciones', parada_devoluciones,
                            'motivo', parada_motivo, 'desde', parada_en)
    from public.config_pagos where id
$$;

create or replace function public.parar_pagos(p_que text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_que is null or p_que not in ('cobros', 'devoluciones') then
    raise exception 'Freno no válido.' using errcode = 'P0001';
  end if;
  update public.config_pagos
     set parada_cobros       = parada_cobros or p_que = 'cobros',
         parada_devoluciones = parada_devoluciones or p_que = 'devoluciones',
         parada_motivo       = left(p_motivo, 300),
         parada_en           = coalesce(parada_en, now())
   where id;
  return public.estado_paradas();
end;
$$;

create or replace function public.reanudar_pagos(p_que text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_que is null or p_que not in ('cobros', 'devoluciones') then
    raise exception 'Freno no válido.' using errcode = 'P0001';
  end if;
  update public.config_pagos
     set parada_cobros       = parada_cobros and p_que <> 'cobros',
         parada_devoluciones = parada_devoluciones and p_que <> 'devoluciones'
   where id;
  update public.config_pagos
     set parada_motivo = null, parada_en = null
   where id and not parada_cobros and not parada_devoluciones;
  return public.estado_paradas();
end;
$$;

create or replace function public.bloquear_cobros_en_parada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.config_pagos where id and parada_cobros) then
    raise exception 'Los pagos online están en pausa temporalmente. No se te ha cobrado nada. Inténtalo más tarde.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bloquear_cobros_en_parada on public.cobros;
create trigger trg_bloquear_cobros_en_parada
  before insert on public.cobros
  for each row execute function public.bloquear_cobros_en_parada();

-- ----------------------------------------------------------------------------
-- Alertas
--   p_parar      null | 'cobros' | 'devoluciones'
--   p_umbral     repeticiones (con menos de 1 h entre una y otra) a partir de las cuales se para
-- ----------------------------------------------------------------------------
create or replace function public.registrar_alerta(
  p_tipo     text,
  p_clave    text,
  p_gravedad text,
  p_detalle  text,
  p_parar    text default null,
  p_umbral   integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_veces integer;
begin
  insert into public.alertas_operativas as a (tipo, clave, gravedad, detalle)
  values (p_tipo, left(p_clave, 120), p_gravedad, left(p_detalle, 600))
  on conflict (clave) where resuelta_en is null do update
    set veces      = case when a.ultima_en < now() - interval '1 hour' then 1 else a.veces + 1 end,
        ultima_en  = now(),
        detalle    = excluded.detalle,
        -- Si sube de gravedad se vuelve a avisar.
        avisada_en = case when a.gravedad = 'aviso' and excluded.gravedad = 'critica' then null else a.avisada_en end,
        gravedad   = case when a.gravedad = 'critica' then 'critica' else excluded.gravedad end
  returning veces into v_veces;

  if p_parar is not null and v_veces >= greatest(coalesce(p_umbral, 1), 1) then
    perform public.parar_pagos(p_parar, p_detalle);
    return jsonb_build_object('ok', true, 'veces', v_veces, 'parado', p_parar);
  end if;
  return jsonb_build_object('ok', true, 'veces', v_veces, 'parado', null);
end;
$$;

create or replace function public.resolver_alerta_clave(p_clave text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.alertas_operativas set resuelta_en = now() where clave = p_clave and resuelta_en is null
$$;

create or replace function public.resolver_alerta(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.alertas_operativas set resuelta_en = now() where id = p_id and resuelta_en is null
$$;

-- Nuevas, o que siguen ocurriendo 24 h después del último correo.
create or replace function public.alertas_por_avisar()
returns setof public.alertas_operativas
language sql
stable
security definer
set search_path = public
as $$
  select * from public.alertas_operativas
   where (resuelta_en is null and avisada_en is null)
      or (resuelta_en is null and ultima_en > avisada_en and avisada_en < now() - interval '24 hours')
   order by (gravedad = 'critica') desc, primera_en
   limit 50
$$;

create or replace function public.marcar_alertas_avisadas(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.alertas_operativas set avisada_en = now() where id = any (p_ids)
$$;

-- Registra o cierra una alerta según se cumpla la condición (uso interno).
create or replace function public.alerta_segun(
  p_condicion boolean, p_tipo text, p_clave text, p_gravedad text, p_detalle text, p_parar text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_condicion then
    perform public.registrar_alerta(p_tipo, p_clave, p_gravedad, p_detalle, p_parar);
  else
    perform public.resolver_alerta_clave(p_clave);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Revisión periódica. Cada bloque va aislado: si uno falla, los demás se ejecutan y queda una alerta.
-- ----------------------------------------------------------------------------
create or replace function public.revisar_salud_pagos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     integer;
  v_m     integer;
  r       record;
  v_malas integer := 0;
begin
  -- 1) Cola de notificaciones
  begin
    select count(*), count(*) filter (where created_at < now() - interval '15 minutes')
      into v_n, v_m from public.notificaciones_cola where estado = 'pendiente';
    perform public.alerta_segun(v_n > 200 or v_m > 0, 'cola', 'cola:atasco',
      case when v_n > 1000 then 'critica' else 'aviso' end,
      format('Cola de notificaciones: %s pendientes, %s con más de 15 minutos.', v_n, v_m));
    select count(*) into v_n from public.notificaciones_cola
     where estado = 'error' and created_at > now() - interval '1 hour';
    perform public.alerta_segun(v_n > 20, 'cola', 'cola:errores', 'aviso',
      format('%s notificaciones de la última hora no se han podido enviar.', v_n));
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:cola', 'aviso', 'No se ha podido revisar la cola: ' || sqlerrm);
  end;

  -- 2) Crons de la base de datos y llamadas HTTP que hacen
  begin
    for r in
      select j.jobname,
             count(*) filter (where d.status = 'failed' and d.start_time > now() - interval '1 hour') as fallos
        from cron.job j
        left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '1 hour'
       group by j.jobname
    loop
      perform public.alerta_segun(r.fallos > 0, 'cron', 'cron:' || r.jobname, 'critica',
        format('El cron «%s» ha fallado %s veces en la última hora.', r.jobname, r.fallos));
    end loop;
    if to_regclass('net._http_response') is not null then
      select count(*) into v_n from net._http_response
       where created > now() - interval '15 minutes'
         and (status_code >= 400 or timed_out or error_msg is not null);
      perform public.alerta_segun(v_n >= 3, 'cron', 'cron:llamadas_http', 'critica',
        format('%s llamadas programadas a la web han fallado en 15 minutos (revisar CRON_SECRET y Vercel).', v_n));
    end if;
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:cron', 'aviso', 'No se han podido revisar los crons: ' || sqlerrm);
  end;

  -- 3) Devoluciones
  begin
    select count(*) into v_n from public.cobros
     where estado = 'requiere_reembolso' and updated_at < now() - interval '48 hours';
    perform public.alerta_segun(v_n > 0, 'devoluciones', 'devoluciones:pendientes', 'critica',
      format('%s cobros llevan más de 48 h esperando devolución.', v_n));
    select count(*) into v_n
      from public.cobros co join public.clases cl on cl.id = co.clase_id
     where co.estado = 'pagado' and cl.estado = 'cancelada';
    perform public.alerta_segun(v_n > 0, 'devoluciones', 'devoluciones:sesion_cancelada', 'critica',
      format('%s cobros de sesiones canceladas siguen como pagados: hay que tramitar su devolución.', v_n));
    if to_regclass('public.devoluciones') is not null then
      select count(*) into v_n from public.devoluciones
       where estado = 'en_curso' and iniciada_en < now() - interval '30 minutes';
      perform public.alerta_segun(v_n > 0, 'devoluciones', 'devoluciones:en_curso_antiguas', 'critica',
        format('%s devoluciones sin respuesta del banco: revisar a mano antes de reintentar.', v_n), 'devoluciones');
      select count(*) into v_n from public.devoluciones
       where estado = 'fallida' and updated_at > now() - interval '1 hour';
      perform public.alerta_segun(v_n >= 3, 'devoluciones', 'devoluciones:rechazos_seguidos', 'critica',
        format('%s devoluciones rechazadas en la última hora.', v_n), 'devoluciones');
      select count(*) into v_n from public.devoluciones where estado = 'fallida' and intentos >= 5;
      perform public.alerta_segun(v_n > 0, 'devoluciones', 'devoluciones:agotadas', 'critica',
        format('%s devoluciones han agotado los reintentos.', v_n));
    end if;
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:devoluciones', 'aviso', 'No se han podido revisar las devoluciones: ' || sqlerrm);
  end;

  -- 4) Liberación de saldos (base de las liquidaciones) y cuadre de bolsas
  begin
    select count(*) into v_n
      from public.cobros c
      join public.clases cl on cl.id = c.clase_id
     where c.estado = 'pagado' and c.liberado_en is null and cl.estado <> 'cancelada'
       and ((cl.fecha::text || ' ' || cl.hora::text)::timestamp + make_interval(mins => coalesce(cl.duracion, 60)))
             at time zone 'Europe/Madrid'
           + make_interval(hours => (select horas_liberacion + 2 from public.config_pagos where id)) < now();
    perform public.alerta_segun(v_n > 0, 'liquidaciones', 'liquidaciones:liberacion_atrasada', 'critica',
      format('%s cobros deberían haberse liberado ya al organizador (revisar liberar_pendientes).', v_n));
    select count(*) into v_n
      from public.bolsas b
      left join (
        select entrenador_id,
               coalesce(sum(importe_centimos) filter (where bolsa = 'pendiente'), 0) as pendiente,
               coalesce(sum(importe_centimos) filter (where bolsa = 'disponible'), 0) as disponible
          from public.movimientos_bolsa group by entrenador_id
      ) m on m.entrenador_id = b.entrenador_id
     where b.pendiente_centimos <> coalesce(m.pendiente, 0) or b.disponible_centimos <> coalesce(m.disponible, 0);
    perform public.alerta_segun(v_n > 0, 'liquidaciones', 'liquidaciones:bolsa_descuadrada', 'critica',
      format('%s bolsas no cuadran con sus movimientos.', v_n), 'cobros');
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:liquidaciones', 'aviso', 'No se han podido revisar los saldos: ' || sqlerrm);
  end;

  -- 5) Avisos del banco que no llegan
  begin
    select count(*) into v_n from public.cobros
     where estado = 'creado' and created_at between now() - interval '24 hours' and now() - interval '2 hours';
    perform public.alerta_segun(v_n >= 10, 'webhook', 'webhook:sin_confirmar', 'aviso',
      format('%s cobros de las últimas 24 h siguen sin respuesta del banco.', v_n));
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:webhook', 'aviso', 'No se han podido revisar los cobros: ' || sqlerrm);
  end;

  -- 6) Reclamaciones sin atender (sql/098)
  begin
    if to_regclass('public.incidencias_pago') is not null then
      select count(*) into v_n from public.incidencias_pago where estado = 'abierta';
      perform public.alerta_segun(v_n > 0, 'incidencias', 'incidencias:sin_revisar', 'aviso',
        format('%s reclamaciones de pago sin revisar (/admin/incidencias).', v_n));
    end if;
  exception when others then
    v_malas := v_malas + 1;
    perform public.registrar_alerta('cron', 'revision:incidencias', 'aviso', 'No se han podido revisar las reclamaciones: ' || sqlerrm);
  end;

  -- Las claves de esta función no deben coincidir con las que registra la web (lib/pagos/alertas.ts): aquí una
  -- condición que no se cumple CIERRA su alerta.
  return jsonb_build_object('ok', v_malas = 0, 'bloques_fallidos', v_malas, 'paradas', public.estado_paradas(),
    'abiertas', (select count(*) from public.alertas_operativas where resuelta_en is null));
end;
$$;

-- Permisos: solo el servicio.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.estado_paradas()', 'public.parar_pagos(text, text)', 'public.reanudar_pagos(text)',
    'public.registrar_alerta(text, text, text, text, text, integer)', 'public.resolver_alerta_clave(text)',
    'public.resolver_alerta(uuid)', 'public.alertas_por_avisar()', 'public.marcar_alertas_avisadas(uuid[])',
    'public.alerta_segun(boolean, text, text, text, text, text)', 'public.revisar_salud_pagos()',
    'public.bloquear_cobros_en_parada()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
