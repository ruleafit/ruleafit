-- ============================================================================
-- Ruleafit · 109_gratis_sin_bono.sql
-- Requiere sql/087 (y 073). No activa pagos ni mueve dinero. Repetible.
-- Regla: una sesión gratuita (precio 0 o sin precio) nunca gasta un uso de bono.
--  1) reservar_clase(): la de sql/087 con esa única condición. Su versión vigente es esta.
--  2) Si una sesión pasa a ser gratuita, sus reservas activas dejan de gastar bono.
--  3) Corrige las reservas ya hechas en sesiones gratuitas: devuelve esos usos a los bonos no anulados.
-- Reversión: sql/109_gratis_sin_bono_reversion.sql (no vuelve a descontar los usos devueltos).
-- ============================================================================
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
  -- sql/109: una sesión gratuita (precio 0 o sin precio) nunca gasta un uso de bono.
  if coalesce(v_clase.precio, 0) > 0 then
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
  end if;

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

create or replace function public.liberar_bono_si_gratis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reservas set bono_cliente_id = null
   where clase_id = new.id and estado = 'activa' and bono_cliente_id is not null;
  return null;
end;
$$;
revoke all on function public.liberar_bono_si_gratis() from public, anon, authenticated;
drop trigger if exists trg_liberar_bono_si_gratis on public.clases;
create trigger trg_liberar_bono_si_gratis
  after update of precio on public.clases
  for each row
  when (coalesce(new.precio, 0) = 0 and coalesce(old.precio, 0) > 0)
  execute function public.liberar_bono_si_gratis();

update public.reservas r set bono_cliente_id = null
  from public.clases c
 where c.id = r.clase_id and coalesce(c.precio, 0) = 0 and r.bono_cliente_id is not null
   and not exists (select 1 from public.bonos_clientes bc
                    where bc.id = r.bono_cliente_id and to_jsonb(bc) ->> 'anulado_en' is not null);
