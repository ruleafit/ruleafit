-- ============================================================================
-- Ruleafit · 096_devoluciones.sql
-- Devoluciones reales por Redsys. Requiere sql/071 y sql/072.
-- NO EJECUTADO. No activa pagos (config_pagos.pagos_activos sigue como esté).
--
-- Flujo (lo orquesta /api/payments/devolver):
--   1) reclamar_devolucion()  -> bloquea un cobro 'requiere_reembolso' y lo marca en curso.
--   2) El servidor pide la devolución al banco (transacción tipo 3).
--   3) completar_devolucion() -> SOLO si el banco confirma (0900): cobro 'reembolsado',
--      se deshace el abono en la bolsa del entrenador y se anota el movimiento.
-- Un fallo o una respuesta dudosa nunca marca 'reembolsado'. Una devolución 'en_curso'
-- sin resolver NO se reintenta sola (podría haberse ejecutado): requiere revisión manual.
-- ============================================================================

create table if not exists public.devoluciones (
  id                uuid primary key default gen_random_uuid(),
  cobro_id          uuid not null unique references public.cobros(id) on delete restrict,
  importe_centimos  integer not null check (importe_centimos > 0),
  estado            text not null default 'en_curso'
                      check (estado in ('en_curso', 'completada', 'fallida')),
  intentos          integer not null default 1,
  codigo_respuesta  text,
  ultimo_error      text,
  iniciada_en       timestamptz not null default now(),
  completada_en     timestamptz,
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_devoluciones_updated on public.devoluciones;
create trigger trg_devoluciones_updated
  before update on public.devoluciones
  for each row execute function public.pagos_tocar_updated_at();

alter table public.devoluciones enable row level security;
revoke all on public.devoluciones from anon, authenticated;
-- Sin políticas: solo service_role y funciones SECURITY DEFINER.

-- 1) Reclamar la siguiente devolución pendiente (o fallida con menos de 5 intentos).
create or replace function public.reclamar_devolucion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro public.cobros%rowtype;
  v_dev   public.devoluciones%rowtype;
begin
  select c.* into v_cobro
    from public.cobros c
    left join public.devoluciones d on d.cobro_id = c.id
   where c.estado = 'requiere_reembolso'
     and (d.id is null or (d.estado = 'fallida' and d.intentos < 5))
   order by c.updated_at
   limit 1
   for update of c skip locked;

  if not found then
    return jsonb_build_object('ok', true, 'resultado', 'nada_pendiente');
  end if;

  select * into v_dev from public.devoluciones where cobro_id = v_cobro.id for update;
  if not found then
    insert into public.devoluciones (cobro_id, importe_centimos)
    values (v_cobro.id, v_cobro.importe_centimos);
  else
    update public.devoluciones
       set estado = 'en_curso', intentos = intentos + 1, iniciada_en = now()
     where cobro_id = v_cobro.id;
  end if;

  return jsonb_build_object('ok', true, 'resultado', 'reclamada',
    'cobro_id', v_cobro.id, 'pedido', v_cobro.pedido_redsys,
    'importe_centimos', v_cobro.importe_centimos);
end;
$$;

-- 2) Cerrar la devolución según lo que dijo el banco. Idempotente.
create or replace function public.completar_devolucion(
  p_cobro_id          uuid,
  p_confirmada        boolean,
  p_codigo_respuesta  text default null,
  p_detalle           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro public.cobros%rowtype;
  v_dev   public.devoluciones%rowtype;
  v_abono bigint;
  v_lib   bigint;
begin
  select * into v_cobro from public.cobros where id = p_cobro_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'resultado', 'desconocido');
  end if;
  select * into v_dev from public.devoluciones where cobro_id = p_cobro_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'resultado', 'sin_devolucion');
  end if;
  if v_dev.estado = 'completada' then
    return jsonb_build_object('ok', true, 'resultado', 'ya_procesado');
  end if;

  if not coalesce(p_confirmada, false) then
    update public.devoluciones
       set estado = 'fallida', codigo_respuesta = p_codigo_respuesta, ultimo_error = left(p_detalle, 500)
     where cobro_id = p_cobro_id;
    return jsonb_build_object('ok', true, 'resultado', 'fallida');
  end if;

  -- Confirmada por el banco.
  update public.cobros set estado = 'reembolsado' where id = p_cobro_id;
  update public.devoluciones
     set estado = 'completada', codigo_respuesta = p_codigo_respuesta,
         ultimo_error = null, completada_en = now()
   where cobro_id = p_cobro_id;

  -- Bolsa: solo si el cobro llegó a abonarse al entrenador.
  select coalesce(sum(importe_centimos), 0) into v_abono
    from public.movimientos_bolsa
   where cobro_id = p_cobro_id and tipo = 'abono_pendiente';
  if v_abono > 0 and v_cobro.entrenador_id is not null then
    select coalesce(sum(importe_centimos), 0) into v_lib
      from public.movimientos_bolsa
     where cobro_id = p_cobro_id and tipo = 'liberacion' and bolsa = 'disponible';
    if v_lib > 0 then
      -- Ya liberado: se descuenta de disponible (puede quedar negativo; se compensa en la siguiente liquidación).
      update public.bolsas set disponible_centimos = disponible_centimos - v_abono
       where entrenador_id = v_cobro.entrenador_id;
      insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
      values (v_cobro.entrenador_id, p_cobro_id, 'reembolso', 'disponible', -v_abono, 'Devolución al alumno');
    else
      update public.bolsas set pendiente_centimos = greatest(pendiente_centimos - v_abono, 0)
       where entrenador_id = v_cobro.entrenador_id;
      insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
      values (v_cobro.entrenador_id, p_cobro_id, 'reembolso', 'pendiente', -v_abono, 'Devolución al alumno');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'resultado', 'completada');
end;
$$;

revoke all on function public.reclamar_devolucion() from public, anon, authenticated;
revoke all on function public.completar_devolucion(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.reclamar_devolucion() to service_role;
grant execute on function public.completar_devolucion(uuid, boolean, text, text) to service_role;
