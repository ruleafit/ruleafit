-- Reversión de 100. Restaura cancelar_reserva de sql/087 y borra el historial de reprogramaciones.
-- Las sesiones reprogramadas conservan su nueva fecha y ubicación.
drop trigger if exists trg_reprogramacion_tras_pago on public.reservas;
drop function if exists public.reprogramacion_tras_pago();

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
revoke all on function public.cancelar_reserva(uuid) from anon;

drop function if exists public.responder_reprogramacion(uuid, boolean);
drop function if exists public.mis_reprogramaciones_pendientes();
drop function if exists public.reprogramar_sesion(uuid, jsonb);
drop table if exists public.reprogramacion_respuestas;
drop table if exists public.reprogramaciones;
