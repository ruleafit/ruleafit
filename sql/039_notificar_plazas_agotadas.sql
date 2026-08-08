-- 039_notificar_plazas_agotadas.sql
-- Modifica reservar_clase para avisar al ENTRENADOR (tipo 'plazas_agotadas')
-- cuando una reserva agota las plazas de su sesion, por si quiere ampliarlas.
-- Cambios respecto a sql/001: (a) el SELECT del paso 3 trae ademas trainer_id
-- y titulo; (b) nuevo paso 8b que encola la notificacion si la sesion se acaba
-- de llenar. El resto de la logica de reserva queda IGUAL.

create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id   uuid;
  v_rol          text;
  v_clase        record;
  v_clase_inicio timestamp;
  v_ahora_local  timestamp;
  v_reserva_id   uuid;
  v_ya_reservada boolean;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debe iniciar sesión para reservar.' using errcode = '28000';
  end if;

  -- 2. Debe ser un usuario con rol "cliente" (guardado en user_metadata.rol).
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
   where id = v_usuario_id;

  if v_rol is distinct from 'cliente' then
    raise exception 'Solo los clientes pueden reservar clases.' using errcode = '42501';
  end if;

  -- 3. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine: si dos reservas llegan a la vez para la misma
  --    clase, la segunda espera a que la primera confirme o falle antes de
  --    leer plazas_ocupadas, así nunca ven ambas el mismo hueco libre.
  --    (Se traen ademas trainer_id y titulo para la notificacion del paso 8b.)
  select id, estado, fecha, hora, plazas_max, plazas_ocupadas, trainer_id, titulo
    into v_clase
    from public.clases
   where id = p_clase_id
   for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 4. Debe estar activa y no haber empezado ya (fecha + hora exactas,
  --    comparadas en hora local de España).
  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 5. No debe estar completa.
  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;

  -- 6. El cliente no debe tener ya una reserva activa para esta clase.
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

  -- 7. Insertar la reserva.
  insert into public.reservas (clase_id, cliente_id)
  values (p_clase_id, v_usuario_id)
  returning id into v_reserva_id;

  -- 8. Incrementar las plazas ocupadas de la clase.
  update public.clases
     set plazas_ocupadas = plazas_ocupadas + 1
   where id = p_clase_id;

  -- 8b. Si esta reserva ha llenado la sesión, avisar al entrenador (tipo
  --     'plazas_agotadas') por si quiere ampliar plazas. Como el paso 5 ya
  --     garantiza plazas_ocupadas < plazas_max, basta comprobar que tras
  --     sumar 1 se alcanza el maximo. Se envuelve en un bloque con captura
  --     de excepciones para que un fallo al encolar la notificacion NUNCA
  --     tumbe la reserva (que es lo critico).
  if (v_clase.plazas_ocupadas + 1) = v_clase.plazas_max then
    begin
      insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (
        v_clase.trainer_id,
        'plazas_agotadas',
        'Sesión completa',
        'Tu sesión "' || v_clase.titulo || '" ha agotado sus plazas. Puedes ampliarlas si quieres.',
        '/clases/' || p_clase_id::text
      );
    exception when others then
      null;
    end;
  end if;

  -- 9. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'clase_id', p_clase_id,
    'plazas_ocupadas', v_clase.plazas_ocupadas + 1,
    'plazas_max', v_clase.plazas_max
  );
end;
$$;

comment on function public.reservar_clase(uuid) is
  'Reserva una clase para el cliente autenticado. Valida rol, estado de la clase, aforo y duplicados. Bloquea la fila de la clase para evitar sobreventa. Inserta la reserva e incrementa plazas_ocupadas. Avisa al entrenador si la reserva agota las plazas.';
