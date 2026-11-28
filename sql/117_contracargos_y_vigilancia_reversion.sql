-- Reversión de sql/117. Restaura cobro_retenido (108), liquidacion_cobros (114) y reclamar_devolucion_cobro (096).
-- Los movimientos de contracargo ya anotados NO se deshacen (la bolsa solo admite inserciones).
-- La tabla public.contracargos se conserva como registro contable.
drop function if exists public.revisar_vigilancia();
drop function if exists public.resolver_contracargo(uuid, text);
drop function if exists public.registrar_contracargo(text, integer, text, text, date);

create or replace function public.cobro_retenido(p_cobro_id uuid, p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.incidencias_pago i
     where i.estado in ('abierta', 'en_revision')
       and (i.cobro_id = p_cobro_id or i.reserva_id = p_reserva_id)
  ) or exists (
    select 1 from public.cobros c
      join public.reservas r on r.bono_cliente_id = c.bono_cliente_id
      join public.incidencias_pago i on i.reserva_id = r.id
     where c.id = p_cobro_id and c.tipo = 'bono' and i.estado in ('abierta', 'en_revision')
  ) or exists (
    select 1 from public.cobros c join public.bonos_retenciones h on h.organizador_id = c.entrenador_id
     where c.id = p_cobro_id and c.tipo = 'bono' and h.levantada_en is null
  )
$$;

create or replace function public.liquidacion_cobros(p_fin date)
returns table (cobro_id uuid, entrenador_id uuid, liquidado boolean, motivo text, importe bigint)
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (select * from public.config_pagos where id),
  base as (
    select c.id, c.entrenador_id, c.liquidacion_id is not null as liquidado, c.estado, c.tipo,
           c.liberado_en, c.pagado_en, c.bono_cliente_id, c.reserva_id,
           (case when c.estado = 'reembolsado_parcial' then c.neto_centimos - coalesce(c.neto_devuelto_centimos, 0)
                 when c.estado = 'requiere_reembolso' and coalesce(c.neto_devuelto_centimos, 0) > 0 then c.neto_devuelto_centimos
                 else c.neto_centimos end)::bigint as importe
      from public.cobros c
     where c.liberado_en is not null and c.estado in ('pagado', 'reembolsado_parcial', 'requiere_reembolso')
  )
  select b.id, b.entrenador_id, b.liquidado,
         case
           when b.estado = 'requiere_reembolso' then 'en_devolucion'
           when exists (select 1 from public.incidencias_pago i
                         where i.estado in ('abierta', 'en_revision')
                           and (i.cobro_id = b.id or i.reserva_id = b.reserva_id)) then 'retenido'
           when b.liquidado then null
           when public.cobro_retenido(b.id, b.reserva_id) then 'retenido'
           when b.tipo = 'bono' and not cfg.liquidar_bonos_en_plazo
                and (now() at time zone 'Europe/Madrid')::date
                    <= (b.pagado_en at time zone 'Europe/Madrid')::date + cfg.bono_desistimiento_dias
                and exists (select 1 from public.bonos_clientes bc
                             where bc.id = b.bono_cliente_id and bc.anulado_en is null and bc.fecha_fin >= now()
                               and public.bono_usadas(bc.id) * 100
                                   <= coalesce(bc.sesiones_total, 0) * cfg.bono_desistimiento_uso_max_pct) then 'bono_en_plazo'
           when (b.liberado_en at time zone 'Europe/Madrid')::date > p_fin then 'posterior_al_corte'
         end,
         b.importe
    from base b cross join cfg
$$;

create or replace function public.reclamar_devolucion_cobro()
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

alter table public.config_pagos drop column if exists ultima_revision_en;
