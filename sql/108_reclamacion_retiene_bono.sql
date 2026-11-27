-- ============================================================================
-- Ruleafit · 108_reclamacion_retiene_bono.sql
-- Requiere sql/107. No activa pagos ni mueve dinero. Repetible.
-- Regla: una reclamación retiene el saldo. Con 107, la reclamación sobre una sesión reservada CON BONO no retenía
-- nada (esa reserva no tiene cobro propio). Ahora retiene el cobro de ese bono mientras el caso esté abierto.
-- cobro_retenido() vigente: esta. Reversión: volver a ejecutar el bloque cobro_retenido() de sql/107.
-- ============================================================================
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
revoke all on function public.cobro_retenido(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cobro_retenido(uuid, uuid) to service_role;
