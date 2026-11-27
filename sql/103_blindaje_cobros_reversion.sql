-- Reversión de 103. Antes: dar de baja el cron de devoluciones (103_blindaje_cobros_cron_baja.sql) si se programó.
select cron.unschedule('caducar-cobros-abandonados') where exists (select 1 from cron.job where jobname = 'caducar-cobros-abandonados');
drop trigger if exists trg_exigir_perfil_para_sesion_de_pago on public.clases;
drop function if exists public.exigir_perfil_para_sesion_de_pago();
drop function if exists public.caducar_cobros_abandonados();

drop function if exists public.crear_cobro(uuid, text, text);
alter function public.crear_cobro_base(uuid, text, text) rename to crear_cobro;
grant execute on function public.crear_cobro(uuid, text, text) to authenticated;
drop function if exists public.confirmar_cobro_pagado(text, integer, boolean, text, text);
alter function public.confirmar_cobro_pagado_base(text, integer, boolean, text, text) rename to confirmar_cobro_pagado;
grant execute on function public.confirmar_cobro_pagado(text, integer, boolean, text, text) to service_role;

update public.cobros set estado = 'fallido' where estado = 'caducado';
alter table public.cobros drop constraint if exists cobros_estado_check;
alter table public.cobros add constraint cobros_estado_check
  check (estado in ('creado', 'pagado', 'fallido', 'requiere_reembolso', 'reembolsado'));

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

drop function if exists public.abrir_incidencia_cobro(uuid, text, text);
drop index if exists public.incidencias_pago_abierta_cobro_unica;
drop function if exists public.mis_reservas_reclamables();
create or replace function public.mis_reservas_reclamables()
returns table (reserva_id uuid, titulo text, fecha date, hora time, estado_reserva text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, c.titulo::text, c.fecha, c.hora, r.estado::text
    from public.reservas r
    join public.clases c on c.id = r.clase_id
   where r.cliente_id = auth.uid()
   order by r.created_at desc
   limit 100
$$;
revoke all on function public.mis_reservas_reclamables() from public, anon;
grant execute on function public.mis_reservas_reclamables() to authenticated;
