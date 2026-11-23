-- ============================================================================
-- Ruleafit · 087_cancelacion_tardia_reversion.sql
-- Vuelve a la política anterior: no se puede cancelar con menos de 2 h (error P0003) y las
-- funciones de bonos/reserva solo cuentan reservas 'activa'.
-- NO borra la columna reservas.cancelacion_tardia (conserva el histórico de cancelaciones
-- tardías ya hechas; tras revertir, esas sesiones de bono volverían a quedar libres).
-- ============================================================================

create or replace function public.cancelar_reserva(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id          uuid;
  v_reserva              record;
  v_clase                record;
  v_clase_inicio         timestamp;
  v_ahora_local          timestamp;
  v_reembolso_aplicable  boolean;
  v_plazas_ocupadas      integer;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar.' using errcode = '28000';
  end if;

  -- 2. La reserva debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, igual que reservar_clase hace con la clase.
  select id, clase_id, cliente_id, estado
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  -- 3. La reserva debe pertenecer al usuario autenticado. Esta es la única
  --    comprobación que importa para que nadie pueda cancelar una reserva
  --    ajena: da igual qué id de reserva se pase, si su cliente_id no
  --    coincide con auth.uid() la función rechaza antes de escribir nada.
  if v_reserva.cliente_id <> v_usuario_id then
    raise exception 'No puedes cancelar una reserva que no es tuya.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_reserva.estado <> 'activa' then
    raise exception 'Esta reserva ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. La clase asociada debe existir. Se bloquea también su fila porque
  --    esta función va a decrementar plazas_ocupadas más abajo.
  select id, estado, fecha, hora, plazas_ocupadas
    into v_clase
    from public.clases
    where id = v_reserva.clase_id
    for update;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  -- 6. No se puede cancelar una clase que ya ha empezado o ha pasado (mismo
  --    criterio de fecha+hora exacta en hora local de España que usa
  --    reservar_clase, ver sql/001_reservas.sql).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 6b. Barrera real: no se puede cancelar si faltan menos de 2 horas para el inicio.
  if (v_clase_inicio - v_ahora_local) < interval '2 hours' then
    raise exception 'No se puede cancelar con menos de 2 horas de antelacion.' using errcode = 'P0003';
  end if;

  -- 7. ¿Quedaban 2 horas o más hasta el inicio de la clase en el momento de
  --    cancelar? Se calcula y se devuelve para que la interfaz informe al
  --    cliente, pero de momento no dispara ningún cargo ni devolución real
  --    (la cartera todavía no existe, ver Fase 4 en PROGRESS.md).
  v_reembolso_aplicable := (v_clase_inicio - v_ahora_local) >= interval '2 hours';

  -- 8. Cancelar la reserva.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now()
    where id = p_reserva_id;

  -- 9. Decrementar las plazas ocupadas de la clase, sin bajar nunca de 0
  --    (protección defensiva ante cualquier descuadre previo del contador).
  update public.clases
    set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0)
    where id = v_reserva.clase_id
    returning plazas_ocupadas into v_plazas_ocupadas;

  -- 10. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'clase_id', v_reserva.clase_id,
    'plazas_ocupadas', v_plazas_ocupadas,
    'reembolso_aplicable', v_reembolso_aplicable
  );
end;
$$;

comment on function public.cancelar_reserva(uuid) is
  'Cancela una reserva activa del cliente autenticado de forma atómica: valida propiedad de la reserva, que no esté ya cancelada y que la clase no haya empezado, bloquea las filas de reserva y clase para evitar condiciones de carrera, marca la reserva como cancelada, decrementa plazas_ocupadas (sin bajar de 0) y devuelve si quedaban 2h o más para el inicio (reembolso_aplicable), sin aplicar todavía ningún cargo o devolución real.';

revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

create or replace function public.mis_bonos_comprados()
returns table(bono_cliente_id uuid, bono_id uuid, trainer_id uuid, trainer_username text, descripcion text, precio numeric, numero_sesiones integer, sesiones_usadas bigint, fecha_inicio timestamp with time zone, fecha_fin timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  return query
    select
      bc.id as bono_cliente_id,
      b.id as bono_id,
      b.trainer_id,
      coalesce(p.username, 'usuario') as trainer_username,
      b.descripcion,
      b.precio,
      b.numero_sesiones,
      count(r.id) filter (where r.estado = 'activa') as sesiones_usadas,
      bc.fecha_inicio,
      bc.fecha_fin
    from public.bonos_clientes bc
    join public.bonos b on b.id = bc.bono_id
    left join public.perfiles p on p.id = b.trainer_id
    left join public.reservas r on r.bono_cliente_id = bc.id
    where bc.cliente_id = v_usuario_id
    group by bc.id, b.id, p.username
    order by bc.fecha_fin desc;
end;
$$;

create or replace function public.compradores_de_mis_bonos()
returns table(bono_id uuid, bono_descripcion text, bono_precio numeric, numero_sesiones integer, bono_activo boolean, bono_cliente_id uuid, cliente_username text, sesiones_usadas bigint, fecha_inicio timestamp with time zone, fecha_fin timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  return query
    select
      b.id as bono_id,
      b.descripcion as bono_descripcion,
      b.precio as bono_precio,
      b.numero_sesiones,
      b.activo as bono_activo,
      bc.id as bono_cliente_id,
      coalesce(p.username, 'usuario') as cliente_username,
      count(r.id) filter (where r.estado = 'activa') as sesiones_usadas,
      bc.fecha_inicio,
      bc.fecha_fin
    from public.bonos b
    left join public.bonos_clientes bc on bc.bono_id = b.id
    left join public.perfiles p on p.id = bc.cliente_id
    left join public.reservas r on r.bono_cliente_id = bc.id
    where b.trainer_id = v_usuario_id
    group by b.id, bc.id, p.username
    order by b.created_at desc, bc.fecha_fin desc nulls last;
end;
$$;

create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_usuario_id      uuid;
  v_clase           record;
  v_clase_inicio    timestamp;
  v_ahora_local     timestamp;
  v_ahora_utc       timestamptz;
  v_reserva_id      uuid;
  v_ya_reservada    boolean;
  v_bono_cliente_id uuid;
  v_bono_candidato  record;
  v_usadas          bigint;
  v_pagos_activos   boolean;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = '28000';
  end if;

  -- 2. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine: si dos reservas llegan a la vez para la misma
  --    clase, la segunda espera a que la primera confirme o falle antes de
  --    leer plazas_ocupadas, así nunca ven ambas el mismo hueco libre.
  select id, trainer_id, estado, fecha, hora, plazas_max, plazas_ocupadas, precio
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 3. No puedes reservar tu propia clase.
  if v_clase.trainer_id = v_usuario_id then
    raise exception 'No puedes reservar tu propia sesión.' using errcode = '42501';
  end if;

  -- 4. Debe estar activa y no haber empezado ya (fecha + hora exactas,
  --    comparadas en hora local de España).
  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');
  v_ahora_utc := now();

  if v_clase_inicio < v_ahora_local then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 5. No debe estar completa.
  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;

  -- 6. El usuario no debe tener ya una reserva activa para esta clase.
  select exists (
    select 1
    from public.reservas
    where clase_id = p_clase_id
      and cliente_id = v_usuario_id
      and estado = 'activa'
  ) into v_ya_reservada;

  if v_ya_reservada then
    raise exception 'Ya tienes una reserva activa para esta clase.' using errcode = 'P0001';
  end if;

  -- 7. Bonos (sql/063): busca un bono del usuario con este entrenador que
  --     todavía no haya caducado, ordenado por el que caduque antes (para
  --     gastar primero el más urgente). De los que caben por fecha, se queda
  --     con el primero que además tenga hueco por número de sesiones (o sea
  --     ilimitado). Si no hay ninguno, v_bono_cliente_id se queda en null y la
  --     reserva es suelta, igual que hasta ahora.
  for v_bono_candidato in
    select bc.id as bc_id, b.numero_sesiones
    from public.bonos_clientes bc
    join public.bonos b on b.id = bc.bono_id
    where bc.cliente_id = v_usuario_id
      and b.trainer_id = v_clase.trainer_id
      and bc.fecha_fin >= v_ahora_utc
    order by bc.fecha_fin asc
    for update of bc
  loop
    if v_bono_candidato.numero_sesiones is null then
      v_bono_cliente_id := v_bono_candidato.bc_id;
      exit;
    end if;

    select count(*)
      into v_usadas
      from public.reservas
      where bono_cliente_id = v_bono_candidato.bc_id
        and estado = 'activa';

    if v_usadas < v_bono_candidato.numero_sesiones then
      v_bono_cliente_id := v_bono_candidato.bc_id;
      exit;
    end if;
  end loop;

  -- NUEVO (sql/073). Con los pagos activos, una sesión de pago sin bono no se
  -- reserva por aquí: hay que pagarla (la reserva la crea el cobro confirmado).
  if v_bono_cliente_id is null and coalesce(v_clase.precio, 0) > 0 then
    select pagos_activos into v_pagos_activos from public.config_pagos where id;
    if coalesce(v_pagos_activos, false) then
      raise exception 'Esta sesión es de pago: reserva pagando desde la ficha de la sesión.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 8. Insertar la reserva (con o sin bono vinculado).
  insert into public.reservas (clase_id, cliente_id, bono_cliente_id)
  values (p_clase_id, v_usuario_id, v_bono_cliente_id)
  returning id into v_reserva_id;

  -- 9. Incrementar las plazas ocupadas de la clase.
  update public.clases
    set plazas_ocupadas = plazas_ocupadas + 1
    where id = p_clase_id;

  -- 10. Resultado claro de éxito, indicando si se ha usado un bono.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'clase_id', p_clase_id,
    'plazas_ocupadas', v_clase.plazas_ocupadas + 1,
    'plazas_max', v_clase.plazas_max,
    'usado_bono', v_bono_cliente_id is not null
  );
end;
$$;
