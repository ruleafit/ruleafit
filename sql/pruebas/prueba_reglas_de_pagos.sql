-- ============================================================================
-- PRUEBA · reglas de dinero de extremo a extremo (paso 2). Requiere sql/096-113.
-- ⛔ SOLO EN LA BASE DE PRUEBAS. No guarda nada: termina SIEMPRE con un error que deshace todo y cuyo mensaje es el
--    informe («INFORME ...»). Cada línea empieza por «ok» o «FALLO».
-- Usa un organizador con datos fiscales aprobados y otras tres cuentas cualesquiera.
-- ============================================================================
do $prueba$
declare
  v_org uuid; v_al uuid[]; a uuid; b uuid; c uuid;
  inf text[] := '{}';
  v_bono uuid; v_bono2 uuid; v_clase uuid; v_c2 uuid; v_res uuid; v_bc uuid; v_inc uuid;
  j jsonb; n integer; m integer; t text; r record; d0 bigint; d1 bigint; i integer;
begin
  if not (select pagos_activos from public.config_pagos where id) then
    raise exception 'FALLO: los pagos están apagados: no parece la base de pruebas.';
  end if;
  select usuario_id into v_org from public.perfiles_fiscales f
   where estado = 'activo' and exists (select 1 from auth.users u where u.id = f.usuario_id) order by created_at limit 1;
  select array_agg(id) into v_al from (
    select u.id from auth.users u
     where u.id <> v_org
       and not exists (select 1 from public.bloqueos x where v_org in (x.bloqueador_id, x.bloqueado_id) and u.id in (x.bloqueador_id, x.bloqueado_id))
     order by u.created_at limit 3) y;
  if v_org is null or coalesce(array_length(v_al, 1), 0) < 3 then
    raise exception 'FALLO: hacen falta un organizador con fiscal aprobado y tres cuentas más.';
  end if;
  a := v_al[1]; b := v_al[2]; c := v_al[3];
  update public.config_pagos set parada_cobros = false, parada_devoluciones = false where id;
  delete from public.bonos_cancelaciones where organizador_id = v_org;
  delete from public.bonos_retenciones where organizador_id = v_org;
  insert into public.suscripciones_pro (usuario_id, estado, periodo_inicio, periodo_fin, primer_alta_en)
  values (v_org, 'activa', now(), now() + interval '1 month', now())
  on conflict (usuario_id) do update set estado = 'activa', periodo_fin = now() + interval '1 month';

  -- Utilidades en tablas temporales de la propia transacción.
  create function pg_temp.como(u uuid) returns void language sql as $f$
    select set_config('request.jwt.claim.sub', coalesce(u::text, ''), true),
           set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u)::text end, true),
           set_config('test.uid', coalesce(u::text, ''), true)
  $f$;
  create function pg_temp.sesion(org uuid, dias integer, precio numeric default 6, plazas integer default 5) returns uuid language sql as $f$
    insert into public.clases (trainer_id, titulo, categoria, tipo_actividad, ciudad, fecha, hora, precio, plazas_max, duracion)
    values (org, 'PRUEBA paso 2', 'Fuerza / funcional', 'Fuerza / funcional', 'Sevilla',
            (now() at time zone 'Europe/Madrid')::date + dias, '10:00', precio, plazas, 60) returning id
  $f$;
  create function pg_temp.pagar(al uuid, clase uuid, ped text, ok boolean default true) returns jsonb language plpgsql as $f$
  begin
    perform pg_temp.como(al);
    perform public.crear_cobro(clase, ped);
    return public.confirmar_cobro_pagado(ped, 600, ok, case when ok then '0000' else '0190' end);
  end $f$;
  create function pg_temp.bono(al uuid, bono uuid, ped text) returns uuid language plpgsql as $f$
  begin
    perform pg_temp.como(al);
    perform public.crear_cobro_bono(bono, ped);
    return (public.confirmar_cobro_pagado(ped, 4000, true, '0000') ->> 'bono_cliente_id')::uuid;
  end $f$;

  -- 1) Rechazo e importe que no coincide
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 20);
    j := pg_temp.pagar(a, v_clase, '980000000001', false);
    select estado into t from public.cobros where pedido_redsys = '980000000001';
    select plazas_ocupadas into n from public.clases where id = v_clase;
    inf := inf || format('%s pago rechazado: cobro %s, %s plazas', case when t = 'fallido' and n = 0 then 'ok' else 'FALLO' end, t, n);
    perform pg_temp.como(b); perform public.crear_cobro(v_clase, '980000000002');
    j := public.confirmar_cobro_pagado('980000000002', 1, true, '0000');
    inf := inf || format('%s importe distinto: %s', case when j ->> 'resultado' = 'importe_no_coincide' then 'ok' else 'FALLO' end, j ->> 'resultado');
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO rechazo: ' || sqlerrm); end;

  -- 2) Última plaza pagada por dos y confirmación tardía de un cobro caducado
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 21, 6, 1);
    perform pg_temp.como(a); perform public.crear_cobro(v_clase, '980000000003');
    perform pg_temp.como(b); perform public.crear_cobro(v_clase, '980000000004');
    perform public.confirmar_cobro_pagado('980000000003', 600, true, '0000');
    perform public.confirmar_cobro_pagado('980000000004', 600, true, '0000');
    select string_agg(estado, ',' order by pedido_redsys) into t from public.cobros where clase_id = v_clase;
    inf := inf || format('%s última plaza: %s', case when t = 'pagado,requiere_reembolso' then 'ok' else 'FALLO' end, t);
    v_c2 := pg_temp.sesion(v_org, 22);
    perform pg_temp.como(c); perform public.crear_cobro(v_c2, '980000000005');
    update public.cobros set created_at = now() - interval '31 minutes' where pedido_redsys = '980000000005';
    perform public.caducar_cobros_abandonados();
    select estado into t from public.cobros where pedido_redsys = '980000000005';
    j := public.confirmar_cobro_pagado('980000000005', 600, true, '0000');
    inf := inf || format('%s cobro caducado (%s) y confirmado tarde: %s', case when t = 'caducado' and j ->> 'resultado' = 'pagado' then 'ok' else 'FALLO' end, t, j ->> 'resultado');
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO última plaza: ' || sqlerrm); end;

  -- 3) Cancelación a tiempo (se devuelve), tardía (no) y devolución confirmada por el banco
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 23); v_c2 := pg_temp.sesion(v_org, 24);
    perform pg_temp.pagar(a, v_clase, '980000000006'); perform pg_temp.pagar(a, v_c2, '980000000007');
    select id into v_res from public.reservas where clase_id = v_clase and cliente_id = a;
    perform public.cancelar_reserva(v_res);
    update public.clases set fecha = ((now() at time zone 'Europe/Madrid') + interval '1 hour')::date,
                             hora = ((now() at time zone 'Europe/Madrid') + interval '1 hour')::time where id = v_c2;
    select id into v_res from public.reservas where clase_id = v_c2 and cliente_id = a;
    perform public.cancelar_reserva(v_res);
    select string_agg(estado, ',' order by pedido_redsys) into t from public.cobros where pedido_redsys in ('980000000006', '980000000007');
    inf := inf || format('%s cancelar a tiempo y tarde: %s', case when t = 'requiere_reembolso,pagado' then 'ok' else 'FALLO' end, t);
    perform pg_temp.como(null);
    for i in 1..50 loop
      j := public.reclamar_devolucion(); exit when j ->> 'resultado' <> 'reclamada';
      perform public.completar_devolucion((j ->> 'cobro_id')::uuid, true, '0900');
    end loop;
    select estado into t from public.cobros where pedido_redsys = '980000000006';
    select coalesce(sum(importe_centimos), 0) into n from public.movimientos_bolsa
     where cobro_id = (select id from public.cobros where pedido_redsys = '980000000006');
    inf := inf || format('%s devolución confirmada: %s, saldo neto del cobro %s', case when t = 'reembolsado' and n = 0 then 'ok' else 'FALLO' end, t, n);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO cancelación: ' || sqlerrm); end;

  -- 4) Bloqueo: cancela reservas futuras, devuelve el pago y la parte no usada del bono
  begin
    perform pg_temp.como(v_org);
    insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 4, 30, 40) returning id into v_bono;
    v_clase := pg_temp.sesion(v_org, 25); v_c2 := pg_temp.sesion(v_org, 26);
    perform pg_temp.pagar(c, v_clase, '980000000008');
    v_bc := pg_temp.bono(c, v_bono, '980000000009');
    perform public.reservar_clase(v_c2);
    perform pg_temp.como(v_org);
    insert into public.bloqueos (bloqueador_id, bloqueado_id) values (v_org, c);
    select count(*) into n from public.reservas where cliente_id = c and clase_id in (v_clase, v_c2) and estado = 'activa';
    select string_agg(estado, ',' order by pedido_redsys) into t from public.cobros where pedido_redsys in ('980000000008', '980000000009');
    inf := inf || format('%s bloqueo: %s reservas activas, cobros %s', case when n = 0 and t = 'requiere_reembolso,requiere_reembolso' then 'ok' else 'FALLO' end, n, t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO bloqueo: ' || sqlerrm); end;

  -- 5) Tres sesiones con alumnos de bono canceladas: se retiene el saldo de bonos
  begin
    perform pg_temp.como(v_org);
    insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 4, 30, 40) returning id into v_bono;
    v_bc := pg_temp.bono(a, v_bono, '980000000010');
    for i in 1..3 loop
      perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 26 + i);
      perform pg_temp.como(a); perform public.reservar_clase(v_clase);
      perform pg_temp.como(v_org); perform public.cancelar_clase(v_clase);
    end loop;
    select count(*) into n from public.bonos_retenciones where organizador_id = v_org and levantada_en is null;
    update public.cobros set pagado_en = now() - interval '49 hours' where pedido_redsys = '980000000010';
    perform public.liberar_pendientes();
    select count(*) into m from public.cobros where pedido_redsys = '980000000010' and liberado_en is not null;
    inf := inf || format('%s cancelaciones reiteradas: %s retención, bono liberado %s', case when n = 1 and m = 0 then 'ok' else 'FALLO' end, n, m);
    perform public.levantar_retencion_bonos(v_org); perform public.liberar_pendientes();
    select count(*) into m from public.cobros where pedido_redsys = '980000000010' and liberado_en is not null;
    inf := inf || format('%s al levantar la retención se libera: %s', case when m = 1 then 'ok' else 'FALLO' end, m);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO retención: ' || sqlerrm); end;

  -- 6) Anular bonos vendidos y borrado de cuenta protegido
  begin
    perform pg_temp.como(v_org);
    insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 4, 30, 40) returning id into v_bono;
    v_bc := pg_temp.bono(a, v_bono, '980000000011');
    perform pg_temp.como(v_org);
    begin perform public.eliminar_mi_cuenta(); t := 'borrada'; exception when others then t := sqlerrm; end;
    inf := inf || format('%s organizador con bonos pendientes no puede borrar: %s', case when t <> 'borrada' then 'ok' else 'FALLO' end, t);
    j := public.cancelar_mis_bonos();
    select estado, importe_devolver_centimos into r from public.cobros where pedido_redsys = '980000000011';
    inf := inf || format('%s anular mis bonos: cobro %s, devolver %s', case when r.estado = 'requiere_reembolso' and r.importe_devolver_centimos = 4000 then 'ok' else 'FALLO' end, r.estado, r.importe_devolver_centimos);
    perform pg_temp.como(a);
    begin perform public.eliminar_mi_cuenta(); t := 'borrada'; exception when others then t := sqlerrm; end;
    inf := inf || format('%s alumno con devolución pendiente no puede borrar: %s', case when t <> 'borrada' then 'ok' else 'FALLO' end, t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO anular bonos: ' || sqlerrm); end;

  -- 7) Autocancelación por no llegar al mínimo
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 29);
    update public.clases set plazas_min = 3 where id = v_clase;
    perform pg_temp.pagar(a, v_clase, '980000000012');
    update public.clases set fecha = ((now() at time zone 'Europe/Madrid') + interval '100 minutes')::date,
                             hora = ((now() at time zone 'Europe/Madrid') + interval '100 minutes')::time where id = v_clase;
    perform pg_temp.como(null); perform public.autocancelar_clases_sin_minimo();
    select cl.estado || ' / ' || co.estado into t from public.clases cl join public.cobros co on co.clase_id = cl.id where cl.id = v_clase;
    inf := inf || format('%s autocancelación: %s', case when t = 'cancelada / requiere_reembolso' then 'ok' else 'FALLO' end, t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO autocancelación: ' || sqlerrm); end;

  -- 8) Datos fiscales en revisión (Canarias, Ceuta y Melilla): ni publicar de pago ni cobrar
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 30);
    update public.perfiles_fiscales set estado = 'pendiente_revision' where usuario_id = v_org;
    begin v_c2 := pg_temp.sesion(v_org, 31); t := 'publicada'; exception when others then t := 'rechazada'; end;
    inf := inf || format('%s en revisión, sesión de pago: %s', case when t = 'rechazada' then 'ok' else 'FALLO' end, t);
    begin v_c2 := pg_temp.sesion(v_org, 32, 0); t := 'publicada'; exception when others then t := sqlerrm; end;
    inf := inf || format('%s en revisión, sesión gratuita: %s', case when t = 'publicada' then 'ok' else 'FALLO' end, t);
    perform pg_temp.como(a);
    begin perform public.crear_cobro(v_clase, '980000000013'); t := 'cobro creado'; exception when others then t := sqlerrm; end;
    inf := inf || format('%s en revisión, cobrar: %s', case when t <> 'cobro creado' then 'ok' else 'FALLO' end, t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO zonas: ' || sqlerrm); end;

  -- 9) Reclamación: retiene el dinero; «Devolver y cerrar» devuelve
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 33);
    perform pg_temp.pagar(a, v_clase, '980000000014');
    select id into v_res from public.reservas where clase_id = v_clase and cliente_id = a;
    j := public.abrir_incidencia(v_res, 'cobro', 'Reclamación de prueba del paso 2');
    v_inc := (j ->> 'id')::uuid;
    update public.clases set fecha = (now() at time zone 'Europe/Madrid')::date - 4 where id = v_clase;
    perform public.liberar_pendientes();
    select count(*) into n from public.cobros where pedido_redsys = '980000000014' and liberado_en is not null;
    inf := inf || format('%s reclamación abierta retiene: liberado %s', case when n = 0 then 'ok' else 'FALLO' end, n);
    perform pg_temp.como(null); perform public.devolver_y_cerrar_incidencia(v_inc, 'Aceptada en la prueba');
    select i.estado || ' / ' || co.estado into t from public.incidencias_pago i join public.cobros co on co.id = i.cobro_id where i.id = v_inc;
    inf := inf || format('%s devolver y cerrar: %s', case when t = 'resuelta / requiere_reembolso' then 'ok' else 'FALLO' end, t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO reclamación: ' || sqlerrm); end;

  -- 10) Reprogramación: quien no acepta cancela sin coste
  begin
    perform pg_temp.como(v_org); v_clase := pg_temp.sesion(v_org, 34);
    perform pg_temp.pagar(a, v_clase, '980000000015');
    perform pg_temp.como(v_org);
    perform public.reprogramar_sesion(v_clase, jsonb_build_object('fecha', (now() at time zone 'Europe/Madrid')::date + 36, 'motivo', 'Prueba'));
    perform pg_temp.como(a);
    select respuesta_id into v_res from public.mis_reprogramaciones_pendientes() where clase_id = v_clase;
    j := public.responder_reprogramacion(v_res, false);
    select estado into t from public.cobros where pedido_redsys = '980000000015';
    inf := inf || format('%s reprogramación rechazada: %s, cobro %s', case when j ->> 'resultado' = 'cancelada' and t = 'requiere_reembolso' then 'ok' else 'FALLO' end, j ->> 'resultado', t);
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO reprogramación: ' || sqlerrm); end;

  -- 11) Bonos por sesión: elegir pagar, bono no admitido y devolución si se queda sin sesiones (sql/113)
  begin
    perform pg_temp.como(v_org);
    update public.clases set bonos_admitidos = '{}' where trainer_id = v_org and estado = 'activa' and precio > 0;
    insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 4, 30, 40) returning id into v_bono;
    insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 8, 30, 40) returning id into v_bono2;
    v_clase := pg_temp.sesion(v_org, 37); v_c2 := pg_temp.sesion(v_org, 38);
    v_bc := pg_temp.bono(b, v_bono, '980000000016');
    j := pg_temp.pagar(b, v_clase, '980000000017');
    select count(*) into n from public.reservas where bono_cliente_id = v_bc;
    inf := inf || format('%s con bono elige pagar: %s, usos gastados %s', case when j ->> 'resultado' = 'pagado' and n = 0 then 'ok' else 'FALLO' end, j ->> 'resultado', n);
    perform pg_temp.como(v_org); perform public.fijar_bonos_sesion(v_c2, 'solo_esta', array[v_bono2]);
    perform pg_temp.como(b);
    begin perform public.reservar_clase(v_c2); t := 'reservada'; exception when others then t := sqlerrm; end;
    inf := inf || format('%s bono no admitido: %s', case when t like '%de pago%' then 'ok' else 'FALLO' end, t);
    -- La primera sesión todavía admite todos: se restringe y el bono se queda sin ninguna.
    perform pg_temp.como(v_org);
    j := to_jsonb(public.previsualizar_bonos_sesion(v_clase, 'solo_esta', array[v_bono2]));
    perform public.fijar_bonos_sesion(v_clase, 'solo_esta', array[v_bono2]);
    set constraints all immediate;
    perform pg_temp.como(b);
    inf := inf || format('%s aviso previo al organizador: %s bono(s)', case when j::text = '1' then 'ok' else 'FALLO' end, j);
    j := public.devolver_bono_sin_sesiones(v_bc);
    inf := inf || format('%s devolución de bono sin sesiones: %s %s', case when j ->> 'resultado' = 'devolucion_pedida' then 'ok' else 'FALLO' end, j ->> 'resultado', j ->> 'importe_centimos');
    set constraints all deferred;
    raise exception using errcode = 'RB000';
  exception when sqlstate 'RB000' then null; when others then inf := inf || ('FALLO bonos por sesión: ' || sqlerrm); end;

  raise exception E'INFORME (nada se ha guardado)\n%', array_to_string(inf, E'\n');
end;
$prueba$;
