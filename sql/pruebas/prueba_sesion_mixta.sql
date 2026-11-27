-- ============================================================================
-- PRUEBA · sesión mixta: un alumno canjea un bono y otros dos pagan la sesión suelta. Requiere sql/107.
-- ⛔ SOLO EN LA BASE DE PRUEBAS. Todo ocurre en una transacción que se DESHACE: no guarda nada.
-- Si algo no cuadra, se detiene con un error que empieza por «FALLO». Si todo va bien, muestra «correcta».
-- Usa un organizador con datos fiscales aprobados y otras tres cuentas cualesquiera.
-- ============================================================================
begin;

do $prueba$
declare
  v_org uuid; v_alumnos uuid[]; v_a uuid; v_b uuid; v_c uuid;
  v_bono uuid; v_bc uuid; v_clase uuid; v_otra uuid;
  p0 bigint; d0 bigint; p bigint; d bigint;
  v_n integer; v_cobros_a integer; r record; j jsonb;

begin
  select usuario_id into v_org from public.perfiles_fiscales f
   where estado = 'activo' and exists (select 1 from auth.users u where u.id = f.usuario_id) order by created_at limit 1;
  select array_agg(id) into v_alumnos from (
    select u.id from auth.users u
     where u.id <> v_org
       and not exists (select 1 from public.bloqueos b where v_org in (b.bloqueador_id, b.bloqueado_id) and u.id in (b.bloqueador_id, b.bloqueado_id))
     order by u.created_at limit 3) x;
  if v_org is null or coalesce(array_length(v_alumnos, 1), 0) < 3 then
    raise exception 'FALLO: hacen falta un organizador con fiscal aprobado y tres cuentas más.';
  end if;
  v_a := v_alumnos[1]; v_b := v_alumnos[2]; v_c := v_alumnos[3];
  if not (select pagos_activos from public.config_pagos where id) then
    raise exception 'FALLO: los pagos están apagados: no parece la base de pruebas.';
  end if;
  update public.config_pagos set parada_cobros = false where id;

  -- Organizador con Pro y un bono de 4 sesiones por 40 €.
  insert into public.suscripciones_pro (usuario_id, estado, periodo_inicio, periodo_fin, primer_alta_en)
  values (v_org, 'activa', now(), now() + interval '1 month', now())
  on conflict (usuario_id) do update set estado = 'activa', periodo_fin = now() + interval '1 month';
  insert into public.bonos (trainer_id, numero_sesiones, plazo_dias, precio) values (v_org, 4, 30, 40) returning id into v_bono;

  select coalesce(sum(pendiente_centimos), 0), coalesce(sum(disponible_centimos), 0) into p0, d0
    from public.bolsas where entrenador_id = v_org;

  -- A compra el bono.
  perform set_config('request.jwt.claim.sub', v_a::text, true), set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true), set_config('test.uid', v_a::text, true);
  perform public.crear_cobro_bono(v_bono, '990000000001');
  j := public.confirmar_cobro_pagado('990000000001', 4000, true, '0000');
  if j ->> 'resultado' <> 'pagado' then raise exception 'FALLO compra del bono: %', j; end if;
  v_bc := (j ->> 'bono_cliente_id')::uuid;
  select * into r from public.cobros where pedido_redsys = '990000000001';
  if r.comision_centimos <> 0 or r.neto_centimos <> 4000 or r.clase_id is not null then raise exception 'FALLO reparto del bono: %', to_jsonb(r); end if;
  select pendiente_centimos into p from public.bolsas where entrenador_id = v_org;
  if p - p0 <> 4000 then raise exception 'FALLO bolsa tras el bono: %', p - p0; end if;

  -- Sesión de 6 € con 5 plazas.
  insert into public.clases (trainer_id, titulo, categoria, tipo_actividad, ciudad, fecha, hora, precio, plazas_max, duracion)
  values (v_org, 'PRUEBA sesión mixta', 'Fuerza / funcional', 'Fuerza / funcional', 'Sevilla',
          (now() at time zone 'Europe/Madrid')::date + 20, '10:00', 6, 5, 60) returning id into v_clase;

  -- A canjea el bono: ocupa plaza y no mueve dinero.
  select count(*) into v_cobros_a from public.cobros where cliente_id = v_a;
  j := public.reservar_clase(v_clase);
  if not (j ->> 'usado_bono')::boolean then raise exception 'FALLO: no ha usado el bono'; end if;
  if (select count(*) from public.cobros where cliente_id = v_a) <> v_cobros_a then raise exception 'FALLO: el canje ha creado un cobro'; end if;
  if (select pendiente_centimos from public.bolsas where entrenador_id = v_org) <> p then raise exception 'FALLO: el canje ha movido la bolsa'; end if;

  -- B y C pagan la sesión suelta.
  perform set_config('request.jwt.claim.sub', v_b::text, true), set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true), set_config('test.uid', v_b::text, true);
  perform public.crear_cobro(v_clase, '990000000002');
  if public.confirmar_cobro_pagado('990000000002', 600, true, '0000') ->> 'resultado' <> 'pagado' then raise exception 'FALLO pago de B'; end if;
  perform set_config('request.jwt.claim.sub', v_c::text, true), set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true), set_config('test.uid', v_c::text, true);
  perform public.crear_cobro(v_clase, '990000000003');
  if public.confirmar_cobro_pagado('990000000003', 600, true, '0000') ->> 'resultado' <> 'pagado' then raise exception 'FALLO pago de C'; end if;
  -- Aviso repetido del banco: nada cambia.
  perform public.confirmar_cobro_pagado('990000000003', 600, true, '0000');

  if (select plazas_ocupadas from public.clases where id = v_clase) <> 3 then raise exception 'FALLO plazas: %', (select plazas_ocupadas from public.clases where id = v_clase); end if;
  if (select count(*) from public.reservas where clase_id = v_clase and estado = 'activa') <> 3
     or (select count(*) from public.reservas where clase_id = v_clase and bono_cliente_id is not null) <> 1 then raise exception 'FALLO reservas'; end if;
  select count(*) into v_n from public.cobros
   where clase_id = v_clase and importe_centimos = 600 and comision_centimos = 60 and neto_centimos = 540 and estado = 'pagado';
  if v_n <> 2 or (select count(*) from public.cobros where clase_id = v_clase) <> 2 then raise exception 'FALLO: deben existir 2 cobros de la sesión, cada uno con 0,60 € de comisión'; end if;
  select pendiente_centimos into p from public.bolsas where entrenador_id = v_org;
  if p - p0 <> 4000 + 540 + 540 then raise exception 'FALLO bolsa pendiente: %', p - p0; end if;

  -- «Mis ingresos»: un apunte por cobro.
  perform set_config('request.jwt.claim.sub', v_org::text, true), set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true), set_config('test.uid', v_org::text, true);
  select count(*) into v_n from jsonb_array_elements(public.mis_ingresos() -> 'cobros') x
   where x ->> 'id' in (select id::text from public.cobros where pedido_redsys like '99000000000_')
     and ((x ->> 'neto_centimos', x ->> 'comision_centimos') in (('4000', '0'), ('540', '60')));
  if v_n <> 3 then raise exception 'FALLO mis_ingresos: % apuntes', v_n; end if;

  -- Liberación: el bono 48 h después de la compra; la sesión, 48 h después de celebrarse. Una sola vez cada uno.
  update public.cobros set pagado_en = now() - interval '49 hours' where pedido_redsys = '990000000001';
  perform public.liberar_pendientes();
  select disponible_centimos into d from public.bolsas where entrenador_id = v_org;
  if (select liberado_en from public.cobros where pedido_redsys = '990000000001') is null
     or (select count(*) from public.cobros where clase_id = v_clase and liberado_en is not null) <> 0 then raise exception 'FALLO liberación del bono'; end if;
  update public.clases set fecha = (now() at time zone 'Europe/Madrid')::date - 4 where id = v_clase;
  perform public.liberar_pendientes();
  perform public.liberar_pendientes();
  if (select count(*) from public.cobros where clase_id = v_clase and liberado_en is not null) <> 2 then raise exception 'FALLO liberación de la sesión'; end if;
  if (select disponible_centimos from public.bolsas where entrenador_id = v_org) - d <> 1080 then raise exception 'FALLO disponible tras la sesión: %', (select disponible_centimos from public.bolsas where entrenador_id = v_org) - d; end if;
  if (select sum(importe_centimos) from public.movimientos_bolsa where cobro_id = (select id from public.cobros where pedido_redsys = '990000000001') and bolsa = 'disponible') <> 4000 then
    raise exception 'FALLO: el bono se ha abonado más de una vez';
  end if;

  -- Cancelación de otra sesión mixta: se devuelve a quien pagó; el bono solo recupera el uso.
  insert into public.clases (trainer_id, titulo, categoria, tipo_actividad, ciudad, fecha, hora, precio, plazas_max, duracion)
  values (v_org, 'PRUEBA sesión mixta cancelada', 'Fuerza / funcional', 'Fuerza / funcional', 'Sevilla',
          (now() at time zone 'Europe/Madrid')::date + 25, '10:00', 6, 5, 60) returning id into v_otra;
  perform set_config('request.jwt.claim.sub', v_a::text, true), set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true), set_config('test.uid', v_a::text, true);
  perform public.reservar_clase(v_otra);
  perform set_config('request.jwt.claim.sub', v_b::text, true), set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true), set_config('test.uid', v_b::text, true);
  perform public.crear_cobro(v_otra, '990000000004');
  perform public.confirmar_cobro_pagado('990000000004', 600, true, '0000');
  perform set_config('request.jwt.claim.sub', v_org::text, true), set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true), set_config('test.uid', v_org::text, true);
  perform public.cancelar_clase(v_otra);
  if (select estado from public.cobros where pedido_redsys = '990000000004') <> 'requiere_reembolso' then raise exception 'FALLO: el pago suelto no queda para devolver'; end if;
  if (select estado from public.cobros where pedido_redsys = '990000000001') <> 'pagado' then raise exception 'FALLO: la cancelación ha tocado el cobro del bono'; end if;
  if (select plazas_ocupadas from public.clases where id = v_otra) <> 0 then raise exception 'FALLO plazas tras cancelar'; end if;
  if (select count(*) from public.reservas where bono_cliente_id = v_bc and estado = 'activa') <> 1 then raise exception 'FALLO: el uso del bono no vuelve'; end if;
end;
$prueba$;

rollback;
select 'Prueba de sesión mixta correcta (no se ha guardado nada)' as resultado;
