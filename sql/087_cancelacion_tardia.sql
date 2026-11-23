-- ============================================================================
-- Ruleafit · 087_cancelacion_tardia.sql
-- Nueva política de cancelación (23-nov-2026):
--
--   · Se puede cancelar una reserva en cualquier momento ANTES de que empiece la sesión.
--   · Faltan 2 h o más  → cancelación «a tiempo»: conserva el derecho a devolución.
--   · Faltan menos de 2 h → cancelación «tardía»: se cancela igual y se libera la plaza, pero
--       - sesión de pago: SIN derecho a devolución (el cobro se queda como 'pagado'; nunca pasa
--         a 'requiere_reembolso' ni a 'reembolsado'),
--       - bono: la sesión del bono se considera CONSUMIDA,
--       - gratuita: solo se cancela.
--   · Una vez empezada la sesión ya no se puede cancelar (igual que antes). Exactamente 2 h
--     cuenta como a tiempo (igual que antes: la comparación era «< 2 horas»).
--   · La reserva cancelada nunca cuenta como asistencia ni da Rulos (esos procesos solo miran
--     reservas 'activa').
--
-- QUÉ CAMBIA
--   1. Columna nueva reservas.cancelacion_tardia (boolean, por defecto false): deja constancia de
--      que esa cancelación fue con menos de 2 h (sin derecho a devolución / bono consumido).
--   2. cancelar_reserva(uuid): se elimina la barrera «< 2 horas» (P0003). Calcula si es tardía,
--      cancela, libera la plaza y, si la reserva tenía un cobro 'pagado' sin liberar:
--         · a tiempo → pasa a 'requiere_reembolso' (mismo estado que usa la cancelación por
--           bloqueo; la devolución real por Redsys sigue sin existir y NO se simula),
--         · tardía   → se queda 'pagado' (sin derecho a devolución; el organizador cobra).
--   3. Uso de bonos: mis_bonos_comprados(), compradores_de_mis_bonos() y el control de cupo de
--      reservar_clase() cuentan como usada la reserva activa O cancelada con cancelacion_tardia.
--      (Es el único cambio en esas tres funciones.)
--
-- QUÉ NO CAMBIA
--   · cancelar_clase (organizador), autocancelación por mínimo y cancelación por bloqueo
--     (sql/086): siguen igual; sus reservas canceladas NO son tardías (el bono vuelve).
--   · Pagos: pagos_activos sigue en false; no hay movimientos de dinero.
--
-- Reversión: sql/087_cancelacion_tardia_reversion.sql
-- ============================================================================

-- 1) Constancia de la cancelación tardía
alter table public.reservas
  add column if not exists cancelacion_tardia boolean not null default false;

comment on column public.reservas.cancelacion_tardia is
  'true = el usuario canceló con menos de 2 h de antelación (sin derecho a devolución; si usaba bono, la sesión del bono queda consumida). Solo la rellena cancelar_reserva().';

-- 2) Cancelación del usuario
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
  v_tardia               boolean;
  v_cobro                uuid;
  v_reembolso            text;
  v_plazas_ocupadas      integer;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar.' using errcode = '28000';
  end if;

  -- 2. La reserva debe existir (FOR UPDATE: dos cancelaciones simultáneas se serializan).
  select id, clase_id, cliente_id, estado, bono_cliente_id
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  -- 3. Debe ser del usuario autenticado.
  if v_reserva.cliente_id <> v_usuario_id then
    raise exception 'No puedes cancelar una reserva que no es tuya.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_reserva.estado <> 'activa' then
    raise exception 'Esta reserva ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. La clase debe existir (se bloquea porque se decrementa plazas_ocupadas).
  select id, estado, fecha, hora, plazas_ocupadas
    into v_clase
    from public.clases
    where id = v_reserva.clase_id
    for update;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  -- 6. Solo antes de que empiece (hora local de España, igual que reservar_clase).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 7. NUEVO: ya no hay barrera. Con menos de 2 h la cancelación es tardía (exactamente 2 h
  --    o más = a tiempo, como antes).
  v_tardia := (v_clase_inicio - v_ahora_local) < interval '2 hours';

  -- 8. Cancelar la reserva y dejar constancia de si fue tardía.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now(),
        cancelacion_tardia = v_tardia
    where id = p_reserva_id;

  -- 9. Liberar la plaza (sin bajar nunca de 0).
  update public.clases
    set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0)
    where id = v_reserva.clase_id
    returning plazas_ocupadas into v_plazas_ocupadas;

  -- 10. Cobro de esta reserva (solo si hubo pago real y no estaba ya liberado/gestionado).
  --     a tiempo → 'requiere_reembolso' (queda pendiente de la futura devolución real);
  --     tardía   → se queda 'pagado': sin derecho a devolución. Nunca se marca 'reembolsado'.
  select id
    into v_cobro
    from public.cobros
    where reserva_id = p_reserva_id
      and estado = 'pagado'
      and liberado_en is null
    order by created_at desc
    limit 1
    for update;

  if v_cobro is not null then
    if v_tardia then
      v_reembolso := 'sin_derecho';
    else
      update public.cobros set estado = 'requiere_reembolso' where id = v_cobro;
      v_reembolso := 'pendiente';
    end if;
  end if;

  -- 11. Resultado. reembolso_aplicable se conserva (true = a tiempo); el resto es informativo
  --     para la interfaz.
  return jsonb_build_object(
    'ok', true,
    'clase_id', v_reserva.clase_id,
    'plazas_ocupadas', v_plazas_ocupadas,
    'reembolso_aplicable', not v_tardia,
    'cancelacion_tardia', v_tardia,
    'usaba_bono', v_reserva.bono_cliente_id is not null,
    'reembolso', v_reembolso
  );
end;
$$;

comment on function public.cancelar_reserva(uuid) is
  'Cancela una reserva activa del cliente autenticado antes de que empiece la sesión, de forma atómica. Con 2 h o más es una cancelación a tiempo (derecho a devolución: un cobro pagado pasa a requiere_reembolso); con menos de 2 h es tardía (reservas.cancelacion_tardia = true: sin devolución, el cobro sigue pagado, y la sesión de un bono queda consumida). En ambos casos libera la plaza. No mueve dinero ni marca nada como reembolsado.';

revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

-- 3) Uso de bonos: una cancelación tardía consume la sesión del bono
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
      count(r.id) filter (where r.estado = 'activa' or r.cancelacion_tardia) as sesiones_usadas,
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
      count(r.id) filter (where r.estado = 'activa' or r.cancelacion_tardia) as sesiones_usadas,
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
  --     sql/087: una reserva cancelada con menos de 2 h (cancelacion_tardia) cuenta como usada.
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
        and (estado = 'activa' or cancelacion_tardia);

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
