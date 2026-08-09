-- 048_plazas_agotadas_via_generar.sql
-- Reconvierte reservar_clase (sql/039) para que el aviso de plazas agotadas al
-- entrenador use generar_notificacion (sql/045) en vez de insertar directo en
-- la cola. Asi el aviso deja constancia en historial ademas de enviarse.
-- UNICO cambio respecto a sql/039: en el paso 8b, el insert directo pasa a una
-- llamada a generar_notificacion, envuelta igual en begin/exception para que un
-- fallo al notificar NUNCA tumbe la reserva. TODA la logica de reserva
-- (validaciones, FOR UPDATE, insert de reserva, incremento de plazas) queda IGUAL.

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
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debe iniciar sesión para reservar.' using errcode = '28000';
  end if;

  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
   where id = v_usuario_id;

  if v_rol is distinct from 'cliente' then
    raise exception 'Solo los clientes pueden reservar clases.' using errcode = '42501';
  end if;

  select id, estado, fecha, hora, plazas_max, plazas_ocupadas, trainer_id, titulo
    into v_clase
    from public.clases
   where id = p_clase_id
   for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;

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

  insert into public.reservas (clase_id, cliente_id)
  values (p_clase_id, v_usuario_id)
  returning id into v_reserva_id;

  update public.clases
     set plazas_ocupadas = plazas_ocupadas + 1
   where id = p_clase_id;

  -- 8b. Si esta reserva ha llenado la sesion, avisar al entrenador via
  --     generar_notificacion (historial + push). Envuelto en begin/exception
  --     para que un fallo al notificar NUNCA tumbe la reserva.
  if (v_clase.plazas_ocupadas + 1) = v_clase.plazas_max then
    begin
      perform public.generar_notificacion(
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
  'Reserva una clase para el cliente autenticado. Valida rol, estado, aforo y duplicados. Bloquea la fila para evitar sobreventa. Inserta la reserva e incrementa plazas_ocupadas. Avisa al entrenador via generar_notificacion (historial + push) si la reserva agota las plazas.';
