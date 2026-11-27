-- ============================================================================
-- Ruleafit · 105_ingresos_retencion.sql
-- Requiere sql/071, 072, 096, 098 y 103. No activa pagos, no mueve dinero y no cambia importes ni comisión.
--
--  1) Retención: un cobro con una reclamación 'abierta' o 'en_revision' NO se libera al organizador. Al cerrarse
--     el caso se libera en la siguiente pasada (cada 15 min). Si se da la razón al alumno se usa «Devolver y
--     cerrar» (punto 4): cerrar sin más libera el dinero.
--     liberar_pendientes() es la de sql/072 con esa única condición añadida: desde aquí, su versión vigente es esta.
--  4) devolver_y_cerrar_incidencia() (solo servicio, panel de administración): en una sola operación marca el cobro
--     para devolución, cancela la reserva si la sesión aún no ha empezado (libera la plaza; el bono no cuenta como
--     usado) y cierra el caso como resuelto con su respuesta.
--  2) mis_ingresos(): lo que ve cada organizador en «Mis ingresos». Solo sus cobros; sin datos del alumno ni el
--     texto de la reclamación. Los saldos salen de bolsas y los importes de cada cobro, sin recalcular nada.
--  3) La alerta de «liberación atrasada» no cuenta los retenidos (resto de revisar_salud_pagos idéntico a sql/103).
--
-- Un importe ya liberado antes de la reclamación sigue en la bolsa disponible; se muestra como retenido y las
-- liquidaciones (aún sin implementar) deberán excluirlo.
-- Reversión: sql/105_ingresos_retencion_reversion.sql
-- ============================================================================

create or replace function public.cobro_retenido(p_cobro_id uuid, p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.incidencias_pago i
     where i.estado in ('abierta', 'en_revision')
       and (i.cobro_id = p_cobro_id or i.reserva_id = p_reserva_id)
  )
$$;
revoke all on function public.cobro_retenido(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cobro_retenido(uuid, uuid) to service_role;

-- 1) Liberación con retención.
create or replace function public.liberar_pendientes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horas  integer;
  v_cobro  record;
  v_total  integer := 0;
begin
  select horas_liberacion into v_horas from public.config_pagos where id;
  if v_horas is null then
    return 0;
  end if;

  for v_cobro in
    select c.id, c.entrenador_id, c.neto_centimos
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.estado = 'pagado'
       and c.liberado_en is null
       -- sql/105: con una reclamación abierta el importe se retiene.
       and not public.cobro_retenido(c.id, c.reserva_id)
       and coalesce(cl.estado, 'activa') <> 'cancelada'
       and (
         case when cl.id is not null
              then ((cl.fecha::text || ' ' || cl.hora::text)::timestamp
                    + make_interval(mins => coalesce(cl.duracion, 60))) at time zone 'Europe/Madrid'
              else c.pagado_en
         end
       ) + make_interval(hours => v_horas) <= now()
     order by c.pagado_en
       for update of c skip locked
  loop
    insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
    values (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'pendiente', -v_cobro.neto_centimos, 'Liberación tras la sesión'),
           (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'disponible', v_cobro.neto_centimos, 'Liberación tras la sesión');

    update public.bolsas
       set pendiente_centimos = pendiente_centimos - v_cobro.neto_centimos,
           disponible_centimos = disponible_centimos + v_cobro.neto_centimos
     where entrenador_id = v_cobro.entrenador_id;

    update public.cobros set liberado_en = now() where id = v_cobro.id;
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.liberar_pendientes() from public, anon, authenticated;
grant execute on function public.liberar_pendientes() to service_role;

-- 2) Ingresos del organizador autenticado.
create or replace function public.mis_ingresos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_horas   integer;
  v_bolsa   record;
  v_res     jsonb;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select horas_liberacion into v_horas from public.config_pagos where id;
  select coalesce(sum(pendiente_centimos), 0) as pendiente, coalesce(sum(disponible_centimos), 0) as disponible
    into v_bolsa from public.bolsas where entrenador_id = v_usuario;

  with mios as (
    -- Solo los cobros que llegaron a abonarse al organizador.
    select c.id, c.estado, c.importe_centimos, c.comision_centimos, c.neto_centimos, c.pagado_en, c.liberado_en,
           coalesce(cl.titulo, c.clase_titulo, 'Sesión') as titulo, cl.fecha, cl.hora,
           case when cl.id is not null
                then ((cl.fecha::text || ' ' || cl.hora::text)::timestamp + make_interval(mins => coalesce(cl.duracion, 60)))
                       at time zone 'Europe/Madrid'
                else c.pagado_en
           end + make_interval(hours => v_horas) as libera_desde,
           public.cobro_retenido(c.id, c.reserva_id) as retenido
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.entrenador_id = v_usuario
       and exists (select 1 from public.movimientos_bolsa m where m.cobro_id = c.id and m.tipo = 'abono_pendiente')
  ), clasificados as (
    select *,
           case when estado = 'reembolsado' then 'devuelto'
                when estado = 'requiere_reembolso' then 'en_devolucion'
                when retenido then 'retenido'
                when liberado_en is not null then 'disponible'
                else 'pendiente'
           end as situacion
      from mios
  )
  select jsonb_build_object(
    'horas_liberacion', v_horas,
    -- Totales de la bolsa, separando lo que no se puede dar por ganado.
    'pendiente_centimos', v_bolsa.pendiente
       - coalesce(sum(neto_centimos) filter (where situacion in ('retenido', 'en_devolucion') and liberado_en is null), 0),
    'disponible_centimos', v_bolsa.disponible
       - coalesce(sum(neto_centimos) filter (where situacion in ('retenido', 'en_devolucion') and liberado_en is not null), 0),
    'retenido_centimos', coalesce(sum(neto_centimos) filter (where situacion = 'retenido'), 0),
    'en_devolucion_centimos', coalesce(sum(neto_centimos) filter (where situacion = 'en_devolucion'), 0),
    'liquidado_centimos', (select coalesce(sum(importe_centimos), 0) from public.liquidaciones_lineas
                            where entrenador_id = v_usuario and estado = 'pagada'),
    'total_cobros', count(*),
    'cobros', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.pagado_en desc)
        from (select id, titulo, fecha, hora, pagado_en, importe_centimos, comision_centimos, neto_centimos,
                     situacion, libera_desde
                from clasificados order by pagado_en desc limit 200) x), '[]'::jsonb),
    'liquidaciones', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', l.fecha_pago, 'importe_centimos', ll.importe_centimos,
                                          'estado', ll.estado, 'iban_ultimos4', ll.iban_ultimos4)
                       order by l.fecha_pago desc)
        from public.liquidaciones_lineas ll join public.liquidaciones l on l.id = ll.liquidacion_id
       where ll.entrenador_id = v_usuario), '[]'::jsonb)
  ) into v_res
  from clasificados;

  return v_res;
end;
$$;
revoke all on function public.mis_ingresos() from public, anon;
grant execute on function public.mis_ingresos() to authenticated;

-- 3) Alerta de liberación atrasada sin los retenidos.
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
       and not public.cobro_retenido(c.id, c.reserva_id)
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

-- 4) Dar la razón al alumno: devolución y cierre, todo o nada. La devolución del dinero la hace después
--    /api/payments/devolver (sql/096).
create or replace function public.devolver_y_cerrar_incidencia(p_id uuid, p_respuesta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caso      public.incidencias_pago%rowtype;
  v_cobro     public.cobros%rowtype;
  v_reserva   record;
  v_cancelada boolean := false;
begin
  if nullif(btrim(coalesce(p_respuesta, '')), '') is null then
    raise exception 'Para cerrar un caso hay que escribir una respuesta.' using errcode = 'P0001';
  end if;
  select * into v_caso from public.incidencias_pago where id = p_id for update;
  if not found then
    raise exception 'El caso no existe.' using errcode = 'P0002';
  end if;
  if v_caso.estado not in ('abierta', 'en_revision') then
    raise exception 'El caso ya está cerrado.' using errcode = 'P0001';
  end if;

  select * into v_cobro from public.cobros
   where (id = v_caso.cobro_id or (v_caso.cobro_id is null and reserva_id = v_caso.reserva_id))
     and estado in ('pagado', 'requiere_reembolso', 'reembolsado')
   order by (estado = 'pagado') desc, created_at desc
   limit 1
   for update;
  if not found then
    raise exception 'Este caso no tiene ningún pago que devolver.' using errcode = 'P0001';
  end if;
  if v_cobro.estado = 'reembolsado' then
    raise exception 'Ese pago ya está devuelto: cierra el caso sin más.' using errcode = 'P0001';
  end if;

  if v_cobro.estado = 'pagado' then
    update public.cobros set estado = 'requiere_reembolso' where id = v_cobro.id;
  end if;

  -- Si la sesión no ha empezado, quien recupera el dinero deja la plaza. Mismo orden que cancelar_reserva.
  select id, clase_id into v_reserva from public.reservas
   where id = v_cobro.reserva_id and estado = 'activa'
   for update;
  if found then
    perform 1 from public.clases c
     where c.id = v_reserva.clase_id and c.estado = 'activa'
       and (c.fecha + c.hora) >= (now() at time zone 'Europe/Madrid')
     for update;
    if found then
      update public.reservas set estado = 'cancelada', cancelled_at = now(), cancelacion_tardia = false
       where id = v_reserva.id;
      update public.clases set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0) where id = v_reserva.clase_id;
      v_cancelada := true;
    end if;
  end if;

  perform public.actualizar_incidencia(p_id, 'resuelta', p_respuesta);

  return jsonb_build_object('ok', true, 'cobro_id', v_cobro.id, 'reserva_cancelada', v_cancelada);
end;
$$;
revoke all on function public.devolver_y_cerrar_incidencia(uuid, text) from public, anon, authenticated;
grant execute on function public.devolver_y_cerrar_incidencia(uuid, text) to service_role;
