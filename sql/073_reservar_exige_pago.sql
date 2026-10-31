-- ============================================================================
-- Ruleafit · 073_reservar_exige_pago.sql
-- Pagos, fase 1: cierra el camino directo a reservar sin pagar.
--
-- Con los pagos activos (config_pagos.pagos_activos = true), una sesión con
-- precio mayor que 0 solo se puede reservar con reservar_clase() si el alumno
-- tiene un bono vigente con ese entrenador (que se descuenta como siempre).
-- Sin bono, la reserva de una sesión de pago solo la crea
-- confirmar_cobro_pagado() cuando el banco confirma el cobro (sql/072), que
-- inserta la reserva por su cuenta y no pasa por esta función.
--
-- Mientras pagos_activos sea false (ahora), reservar_clase() se comporta
-- EXACTAMENTE igual que desde sql/063: el único cambio es el bloque marcado
-- "NUEVO (sql/073)" y la lectura de la columna precio.
--
-- Es una reescritura de la función central de reservas: revisar antes de
-- ejecutar. Después de ejecutarla, comprobar que reservar una sesión gratuita
-- sigue funcionando.
-- ============================================================================

create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
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
comment on function public.reservar_clase(uuid) is
  'Reserva una clase para el usuario autenticado de forma atómica: valida que no sea su propia clase, el estado de la clase, aforo y duplicados, bloquea la fila de la clase para evitar sobreventa, inserta la reserva e incrementa plazas_ocupadas. Si el usuario tiene un bono activo y con hueco para este entrenador lo consume automáticamente (sql/063). Desde sql/073, con los pagos activos (config_pagos.pagos_activos), una sesión de pago sin bono se rechaza: solo se reserva pagando (confirmar_cobro_pagado). El resultado indica en "usado_bono" si se ha consumido un bono.';

revoke all on function public.reservar_clase(uuid) from public;
grant execute on function public.reservar_clase(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- Comprobación posterior (solo lectura):
--   select pg_get_functiondef('public.reservar_clase(uuid)'::regprocedure)
--     like '%sql/073%' as tiene_el_cambio;     -- debe devolver true
-- Y una prueba rápida desde la web: reservar una sesión GRATUITA de otro
-- usuario debe seguir funcionando igual que antes.
-- ----------------------------------------------------------------------------
