-- ============================================================================
-- Ruleafit · 103_blindaje_cobros.sql
-- Requiere sql/071, 072, 096, 098, 099, 101 y 102. No activa pagos ni mueve dinero.
--
--  M1  Con los pagos activos, el servidor impide publicar una sesión de pago (o poner precio) sin perfil fiscal
--      'activo'. Con los pagos apagados no cambia nada.
--  M2  Un alumno solo tiene UN cobro en curso por sesión: si vuelve a pulsar «pagar», se le devuelve el mismo
--      pedido, así el banco solo puede cobrarlo una vez.
--  M3  Un cobro 'creado' caduca a los 30 minutos (estado nuevo 'caducado'). Si el banco confirma después, no se
--      pierde: se intenta dar la plaza y, si no se puede, queda 'requiere_reembolso'.
--  A2  Un pago sin reserva (sin plaza) se ve en Mis reservas y se puede reclamar.
--
-- La lógica de importes y comisión sigue SOLO en las funciones de sql/072, que pasan a llamarse *_base y se
-- envuelven aquí sin copiarlas.
-- Reversión: sql/103_blindaje_cobros_reversion.sql
-- ============================================================================

alter table public.cobros drop constraint if exists cobros_estado_check;
alter table public.cobros add constraint cobros_estado_check
  check (estado in ('creado', 'pagado', 'fallido', 'requiere_reembolso', 'reembolsado', 'caducado'));

-- ----------------------------------------------------------------------------
-- M1
-- ----------------------------------------------------------------------------
create or replace function public.exigir_perfil_para_sesion_de_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.precio, 0) > 0
     and (tg_op = 'INSERT' or new.precio is distinct from old.precio)
     and exists (select 1 from public.config_pagos where id and pagos_activos)
     and not exists (select 1 from public.perfiles_fiscales where usuario_id = new.trainer_id and estado = 'activo')
  then
    raise exception 'Para publicar una sesión de pago necesitas tus datos fiscales aprobados (Mi cuenta → Datos fiscales y cobros).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.exigir_perfil_para_sesion_de_pago() from public, anon, authenticated;
drop trigger if exists trg_exigir_perfil_para_sesion_de_pago on public.clases;
create trigger trg_exigir_perfil_para_sesion_de_pago
  before insert or update of precio on public.clases
  for each row execute function public.exigir_perfil_para_sesion_de_pago();

-- ----------------------------------------------------------------------------
-- M3: caducidad
-- ----------------------------------------------------------------------------
create or replace function public.caducar_cobros_abandonados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.cobros set estado = 'caducado'
   where estado = 'creado' and created_at <= now() - interval '30 minutes';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.caducar_cobros_abandonados() from public, anon, authenticated;
grant execute on function public.caducar_cobros_abandonados() to service_role;

select cron.schedule('caducar-cobros-abandonados', '*/5 * * * *', $$ select public.caducar_cobros_abandonados(); $$);

-- ----------------------------------------------------------------------------
-- M2: crear_cobro envuelve a la de sql/072
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.crear_cobro_base(uuid, text, text)') is null then
    alter function public.crear_cobro(uuid, text, text) rename to crear_cobro_base;
  end if;
  if to_regprocedure('public.confirmar_cobro_pagado_base(text, integer, boolean, text, text)') is null then
    alter function public.confirmar_cobro_pagado(text, integer, boolean, text, text) rename to confirmar_cobro_pagado_base;
  end if;
end;
$$;
revoke all on function public.crear_cobro_base(uuid, text, text) from public, anon, authenticated;
revoke all on function public.confirmar_cobro_pagado_base(text, integer, boolean, text, text) from public, anon, authenticated;

create or replace function public.crear_cobro(p_clase_id uuid, p_pedido text, p_metodo text default 'tarjeta')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_previo  public.cobros%rowtype;
  v_prueba  jsonb;
begin
  if v_usuario is null then
    return public.crear_cobro_base(p_clase_id, p_pedido, p_metodo); -- da el error de siempre
  end if;
  -- Dos pulsaciones simultáneas se atienden de una en una.
  perform pg_advisory_xact_lock(hashtext('cobro:' || v_usuario::text || ':' || coalesce(p_clase_id::text, '')));

  update public.cobros set estado = 'caducado'
   where cliente_id = v_usuario and clase_id = p_clase_id and estado = 'creado'
     and created_at <= now() - interval '30 minutes';

  select * into v_previo from public.cobros
   where cliente_id = v_usuario and clase_id = p_clase_id and estado = 'creado'
   order by created_at desc limit 1
   for update;
  if not found then
    return public.crear_cobro_base(p_clase_id, p_pedido, p_metodo);
  end if;

  -- Hay un pago en curso. Se ensaya un cobro nuevo y se deshace: así se aplican todas las comprobaciones
  -- (pagos activos, freno, perfil, plaza...) y el importe actual, sin copiar ninguna regla.
  begin
    v_prueba := public.crear_cobro_base(p_clase_id, p_pedido, p_metodo);
    raise exception using errcode = 'RFRBK';
  exception when sqlstate 'RFRBK' then
    null;
  end;

  if (v_prueba ->> 'importe_centimos')::integer <> v_previo.importe_centimos then
    -- El precio ha cambiado: el intento anterior deja de valer.
    update public.cobros set estado = 'caducado' where id = v_previo.id;
    return public.crear_cobro_base(p_clase_id, p_pedido, p_metodo);
  end if;

  update public.cobros set metodo = p_metodo where id = v_previo.id;
  return jsonb_build_object('ok', true, 'cobro_id', v_previo.id, 'pedido', v_previo.pedido_redsys,
                            'importe_centimos', v_previo.importe_centimos, 'reutilizado', true);
end;
$$;
revoke all on function public.crear_cobro(uuid, text, text) from public, anon;
grant execute on function public.crear_cobro(uuid, text, text) to authenticated;

create or replace function public.confirmar_cobro_pagado(
  p_pedido text, p_importe_centimos integer, p_autorizado boolean,
  p_codigo_respuesta text default null, p_codigo_autorizacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro public.cobros%rowtype;
begin
  select * into v_cobro from public.cobros where pedido_redsys = p_pedido for update;
  if found and v_cobro.estado = 'caducado' then
    if coalesce(p_autorizado, false) and p_importe_centimos is distinct from v_cobro.importe_centimos then
      return jsonb_build_object('ok', false, 'resultado', 'importe_no_coincide');
    end if;
    -- El banco responde tarde: se procesa con normalidad (plaza si queda; si no, devolución).
    update public.cobros set estado = 'creado' where id = v_cobro.id;
  end if;
  return public.confirmar_cobro_pagado_base(p_pedido, p_importe_centimos, p_autorizado, p_codigo_respuesta, p_codigo_autorizacion);
end;
$$;
revoke all on function public.confirmar_cobro_pagado(text, integer, boolean, text, text) from public, anon, authenticated;
grant execute on function public.confirmar_cobro_pagado(text, integer, boolean, text, text) to service_role;

-- La alerta de «el banco no responde» cuenta también los caducados (resto idéntico a sql/099).
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
     where estado in ('creado', 'caducado') and created_at between now() - interval '24 hours' and now() - interval '2 hours';
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

-- ----------------------------------------------------------------------------
-- A2: pagos sin plaza
-- ----------------------------------------------------------------------------
create unique index if not exists incidencias_pago_abierta_cobro_unica
  on public.incidencias_pago (cobro_id, tipo)
  where reserva_id is null and estado in ('abierta', 'en_revision');

drop function if exists public.mis_reservas_reclamables();
create function public.mis_reservas_reclamables()
returns table (reserva_id uuid, titulo text, fecha date, hora time, estado_reserva text,
               cobro_id uuid, importe_centimos integer, estado_cobro text)
language sql
stable
security definer
set search_path = public
as $$
  (select r.id, c.titulo::text, c.fecha, c.hora, r.estado::text, null::uuid, null::integer, null::text
     from public.reservas r
     join public.clases c on c.id = r.clase_id
    where r.cliente_id = auth.uid()
    order by r.created_at desc
    limit 100)
  union all
  (select null::uuid, coalesce(co.clase_titulo, 'Sesión')::text, c.fecha, c.hora, 'sin_plaza'::text,
          co.id, co.importe_centimos, co.estado::text
     from public.cobros co
     left join public.clases c on c.id = co.clase_id
    where co.cliente_id = auth.uid() and co.reserva_id is null
      and co.estado in ('requiere_reembolso', 'reembolsado')
    order by co.created_at desc
    limit 50)
$$;
revoke all on function public.mis_reservas_reclamables() from public, anon;
grant execute on function public.mis_reservas_reclamables() to authenticated;

create or replace function public.abrir_incidencia_cobro(p_cobro_id uuid, p_tipo text, p_descripcion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_cobro   record;
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
  perform pg_advisory_xact_lock(hashtext('incidencia:' || v_usuario::text));

  select co.id, co.clase_titulo, c.fecha into v_cobro
    from public.cobros co
    left join public.clases c on c.id = co.clase_id
   where co.id = p_cobro_id and co.cliente_id = v_usuario and co.reserva_id is null
     and co.estado in ('requiere_reembolso', 'reembolsado');
  if not found then
    raise exception 'El pago no existe.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.incidencias_pago
              where cobro_id = p_cobro_id and tipo = p_tipo and estado in ('abierta', 'en_revision')) then
    raise exception 'Ya tienes un caso abierto por este motivo para este pago.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.incidencias_pago
       where usuario_id = v_usuario and estado in ('abierta', 'en_revision')) >= 10
     or (select count(*) from public.incidencias_pago
          where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Has abierto muchos casos seguidos. Espera a que revisemos los anteriores.' using errcode = 'P0001';
  end if;

  v_numero := 'RF-' || to_char(now() at time zone 'Europe/Madrid', 'YYYY') || '-'
              || lpad(nextval('public.incidencias_pago_numero_seq')::text, 6, '0');
  insert into public.incidencias_pago (numero, usuario_id, cobro_id, clase_titulo, clase_fecha, tipo, descripcion)
  values (v_numero, v_usuario, p_cobro_id, coalesce(v_cobro.clase_titulo, 'Sesión'), v_cobro.fecha, p_tipo, v_texto)
  returning id into v_id;
  insert into public.incidencias_pago_eventos (incidencia_id, estado) values (v_id, 'abierta');
  begin
    perform public.generar_notificacion(v_usuario, 'incidencia_pago', 'Hemos recibido tu reclamación',
      'Caso ' || v_numero || ': lo revisaremos y verás aquí su estado.', '/mis-reservas?pestana=reclamaciones');
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero);
end;
$$;
revoke all on function public.abrir_incidencia_cobro(uuid, text, text) from public, anon;
grant execute on function public.abrir_incidencia_cobro(uuid, text, text) to authenticated;
