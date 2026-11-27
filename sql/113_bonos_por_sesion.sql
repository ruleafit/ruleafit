-- ============================================================================
-- Ruleafit · 113_bonos_por_sesion.sql
-- Requiere sql/088, sql/107 y sql/109. No activa pagos ni mueve dinero. Repetible.
-- Regla: quien organiza decide en cada sesión si se puede reservar con bono y con cuáles de sus bonos.
--   clases.bonos_admitidos: null = todos sus bonos (también los que cree después); {} = ninguno; lista = solo esos.
--  1) reservar_clase(): la de sql/109 con esa única condición. Su versión vigente es esta.
--  2) fijar_bonos_sesion(): cambia el dato en una sesión o en las futuras de su serie.
--  3) publicar_serie() envuelve a la de sql/088 (publicar_serie_088) y admite la clave «bonos_admitidos».
--     Las sesiones que se añaden luego a una serie heredan el dato de las que ya existen.
--  4) Protección del comprador: bono vendido sin ninguna sesión próxima que lo admita = aviso y devolución de lo no usado.
-- Las reservas ya hechas no cambian. No reejecutar 088 ni 109 después; si se hace, volver a ejecutar este.
-- Reversión: sql/113_bonos_por_sesion_reversion.sql.
-- ============================================================================
alter table public.clases add column if not exists bonos_admitidos uuid[];

create or replace function public.validar_bonos_admitidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_serie text := current_setting('ruleafit.bonos_serie', true);
begin
  if tg_op = 'INSERT' and new.serie_id is not null and new.bonos_admitidos is null then
    if coalesce(v_serie, '') <> '' then
      -- Publicación de una serie: el dato llega desde publicar_serie().
      if jsonb_typeof(v_serie::jsonb) = 'array' then
        new.bonos_admitidos := array(select jsonb_array_elements_text(v_serie::jsonb)::uuid);
      end if;
    else
      -- Sesión añadida a una serie existente: hereda de la última (se descartan bonos que ya no existan).
      select case when c.bonos_admitidos is null then null
                  else array(select b.id from public.bonos b where b.id = any (c.bonos_admitidos)) end
        into new.bonos_admitidos
        from public.clases c
       where c.serie_id = new.serie_id
       order by (c.estado = 'activa') desc, c.fecha desc, c.hora desc
       limit 1;
    end if;
  end if;
  if new.bonos_admitidos is not null then
    new.bonos_admitidos := array(select distinct x from unnest(new.bonos_admitidos) x where x is not null);
    if exists (select 1 from unnest(new.bonos_admitidos) x
                where not exists (select 1 from public.bonos b where b.id = x and b.trainer_id = new.trainer_id)) then
      raise exception 'Solo puedes admitir bonos tuyos.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_bonos_admitidos() from public, anon, authenticated;
drop trigger if exists trg_validar_bonos_admitidos on public.clases;
create trigger trg_validar_bonos_admitidos
  before insert or update of bonos_admitidos on public.clases
  for each row execute function public.validar_bonos_admitidos();

create or replace function public.fijar_bonos_sesion(p_clase_id uuid, p_alcance text, p_bonos uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('serie_op:' || coalesce(auth.uid()::text, '')));
  -- serie_sesiones_objetivo comprueba la sesión iniciada, la propiedad y el alcance; solo devuelve futuras activas.
  update public.clases set bonos_admitidos = p_bonos
   where id in (select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'editadas', v_n);
end;
$$;
revoke all on function public.fijar_bonos_sesion(uuid, text, uuid[]) from public, anon;
grant execute on function public.fijar_bonos_sesion(uuid, text, uuid[]) to authenticated;

do $$
begin
  if to_regprocedure('public.publicar_serie_088(jsonb, jsonb)') is null then
    alter function public.publicar_serie(jsonb, jsonb) rename to publicar_serie_088;
  end if;
end;
$$;
revoke all on function public.publicar_serie_088(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.publicar_serie(p_datos jsonb, p_sesiones jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  perform set_config('ruleafit.bonos_serie', coalesce((p_datos -> 'bonos_admitidos')::text, ''), true);
  v_res := public.publicar_serie_088(p_datos, p_sesiones);
  perform set_config('ruleafit.bonos_serie', '', true);
  return v_res;
end;
$$;
revoke all on function public.publicar_serie(jsonb, jsonb) from public, anon;
grant execute on function public.publicar_serie(jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Protección del comprador: si todas las sesiones de pago próximas del organizador excluyen un bono vendido, se avisa
-- al cliente y puede pedir gratis la devolución de lo no usado, sin límite de 14 días ni de uso. El derecho se
-- mantiene hasta que vuelva a haber una sesión próxima que admita el bono.
-- ----------------------------------------------------------------------------
alter table public.bonos_clientes add column if not exists sin_sesiones_desde timestamptz;

-- Bono pagado online, sin anular ni caducar y con sesiones libres. Interna.
create or replace function public.bono_vivo(p_bono_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bonos_clientes bc
     where bc.id = p_bono_cliente and bc.anulado_en is null and bc.fecha_fin >= now()
       and exists (select 1 from public.cobros co where co.bono_cliente_id = bc.id and co.estado = 'pagado')
       and (select count(*) from public.reservas r
             where r.bono_cliente_id = bc.id and (r.estado = 'activa' or r.cancelacion_tardia)) < coalesce(bc.sesiones_total, 0))
$$;

-- ¿Hay alguna sesión de pago próxima del organizador que admita este bono? Interna.
create or replace function public.bono_con_sesion(p_bono_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.bonos_clientes bc
      join public.bonos b on b.id = bc.bono_id
      join public.clases c on c.trainer_id = b.trainer_id
     where bc.id = p_bono_cliente and c.estado = 'activa' and coalesce(c.precio, 0) > 0
       and (c.fecha + c.hora) > (now() at time zone 'Europe/Madrid')
       and (c.bonos_admitidos is null or bc.bono_id = any (c.bonos_admitidos)))
$$;

-- ¿Todas las próximas lo excluyen? (sin ninguna próxima = false: no se debe a una restricción). Interna.
create or replace function public.bono_excluido_de_todas(p_bono_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_and(c.bonos_admitidos is not null and not (bc.bono_id = any (c.bonos_admitidos))), false)
    from public.bonos_clientes bc
    join public.bonos b on b.id = bc.bono_id
    join public.clases c on c.trainer_id = b.trainer_id
   where bc.id = p_bono_cliente and c.estado = 'activa' and coalesce(c.precio, 0) > 0
     and (c.fecha + c.hora) > (now() at time zone 'Europe/Madrid')
$$;

create or replace function public.bono_devolvible_sin_sesiones(p_bono_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.bono_vivo(p_bono_cliente)
     and not public.bono_con_sesion(p_bono_cliente)
     and (public.bono_excluido_de_todas(p_bono_cliente)
          or exists (select 1 from public.bonos_clientes where id = p_bono_cliente and sin_sesiones_desde is not null))
$$;

-- Anota qué bonos se han quedado sin sesiones y avisa una vez a cada cliente.
create or replace function public.revisar_bonos_sin_sesiones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  begin
    for r in
      select bc.id, bc.cliente_id, bc.sin_sesiones_desde
        from public.bonos_clientes bc
        join public.bonos b on b.id = bc.bono_id
       where b.trainer_id = new.trainer_id and bc.anulado_en is null and bc.fecha_fin >= now()
       order by bc.id
    loop
      if r.sin_sesiones_desde is null then
        if public.bono_vivo(r.id) and public.bono_excluido_de_todas(r.id) then
          update public.bonos_clientes set sin_sesiones_desde = now() where id = r.id;
          begin
            perform public.generar_notificacion(r.cliente_id, 'sesion_cancelada', 'Tu bono se ha quedado sin sesiones',
              'Ninguna sesión próxima admite tu bono. Si quieres, puedes pedir gratis la devolución de lo no usado.',
              '/mis-reservas?pestana=bonos');
          exception when others then null; end;
        end if;
      elsif public.bono_con_sesion(r.id) then
        update public.bonos_clientes set sin_sesiones_desde = null where id = r.id;
      end if;
    end loop;
  exception when others then
    raise warning 'No se han podido revisar los bonos sin sesiones: %', sqlerrm; -- nunca rompe publicar ni cancelar
  end;
  return null;
end;
$$;
drop trigger if exists trg_revisar_bonos_sin_sesiones on public.clases;
create constraint trigger trg_revisar_bonos_sin_sesiones
  after insert or update of bonos_admitidos, estado, precio on public.clases
  deferrable initially deferred
  for each row execute function public.revisar_bonos_sin_sesiones();

-- Aviso al organizador antes de guardar: cuántos bonos vendidos se quedarían sin sesiones. p_clase_id null = sesión
-- nueva. No cambia nada.
create or replace function public.previsualizar_bonos_sesion(p_clase_id uuid, p_alcance text, p_bonos uuid[])
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_ids     uuid[] := '{}';
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_clase_id is not null then
    v_ids := array(select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o);
  end if;
  return (
    with sesiones as (
      select case when c.id = any (v_ids) then p_bonos else c.bonos_admitidos end as admite
        from public.clases c
       where c.trainer_id = v_usuario and c.estado = 'activa' and coalesce(c.precio, 0) > 0
         and (c.fecha + c.hora) > (now() at time zone 'Europe/Madrid')
      union all
      select p_bonos where p_clase_id is null
    )
    select count(*)::integer
      from public.bonos_clientes bc
      join public.bonos b on b.id = bc.bono_id
     where b.trainer_id = v_usuario and public.bono_vivo(bc.id) and not public.bono_devolvible_sin_sesiones(bc.id)
       and (select coalesce(bool_and(s.admite is not null and not (bc.bono_id = any (s.admite))), false) from sesiones s)
  );
end;
$$;

-- Bonos propios que se pueden devolver por este motivo, con lo que se devolvería (misma cuenta que devolver_bono).
create or replace function public.mis_bonos_sin_sesiones()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_object_agg(bc.id, round(co.importe_centimos::numeric
             * (bc.sesiones_total - least(public.bono_usadas(bc.id), bc.sesiones_total)) / bc.sesiones_total)::integer)
      from public.bonos_clientes bc
      join public.cobros co on co.bono_cliente_id = bc.id and co.estado = 'pagado'
     where bc.cliente_id = auth.uid() and public.bono_devolvible_sin_sesiones(bc.id)), '{}'::jsonb);
end;
$$;

create or replace function public.devolver_bono_sin_sesiones(p_bono_cliente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  perform 1 from public.bonos_clientes where id = p_bono_cliente and cliente_id = auth.uid() for update;
  if not found then
    raise exception 'El bono no existe.' using errcode = 'P0002';
  end if;
  if not public.bono_devolvible_sin_sesiones(p_bono_cliente) then
    raise exception 'Este bono tiene sesiones donde usarlo o ya no admite esta devolución.' using errcode = 'P0001';
  end if;
  return public.devolver_bono(p_bono_cliente, 'Sin sesiones donde usarlo');
end;
$$;

revoke all on function public.bono_vivo(uuid), public.bono_con_sesion(uuid), public.bono_excluido_de_todas(uuid),
  public.bono_devolvible_sin_sesiones(uuid), public.revisar_bonos_sin_sesiones() from public, anon, authenticated;
revoke all on function public.previsualizar_bonos_sesion(uuid, text, uuid[]), public.mis_bonos_sin_sesiones(),
  public.devolver_bono_sin_sesiones(uuid) from public, anon;
grant execute on function public.previsualizar_bonos_sesion(uuid, text, uuid[]), public.mis_bonos_sin_sesiones(),
  public.devolver_bono_sin_sesiones(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- reservar_clase(): la de sql/109 con el filtro de bonos admitidos
-- ----------------------------------------------------------------------------
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
  select id, trainer_id, estado, fecha, hora, plazas_max, plazas_ocupadas, precio, bonos_admitidos
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
        -- sql/113: la sesión dice qué bonos admite (null = todos; lista vacía = ninguno).
        and (v_clase.bonos_admitidos is null or b.id = any (v_clase.bonos_admitidos))
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
