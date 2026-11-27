-- ============================================================================
-- Ruleafit · 106_bonos_con_pagos.sql
-- Requiere sql/063 y sql/071. No activa pagos, no mueve dinero y no cambia importes.
-- Los bonos no tienen cobro online: adquirir_bono() solo registra la compra. Con los pagos activos
-- (config_pagos.pagos_activos = true) eso daba un bono gratis con el que reservar sesiones de pago sin pagar.
-- Un trigger impide cualquier alta en bonos_clientes mientras los pagos estén activos.
-- Los bonos adquiridos antes siguen sirviendo. Con los pagos apagados no cambia nada.
-- Quitar el bloqueo solo cuando exista el cobro de bonos. Repetible.
-- Reversión: sql/106_bonos_con_pagos_reversion.sql
-- ============================================================================
create or replace function public.impedir_bono_con_pagos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.config_pagos where id and pagos_activos) then
    raise exception 'La compra de bonos no está disponible mientras el pago online esté activo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.impedir_bono_con_pagos() from public, anon, authenticated;

drop trigger if exists trg_impedir_bono_con_pagos on public.bonos_clientes;
create trigger trg_impedir_bono_con_pagos
  before insert on public.bonos_clientes
  for each row execute function public.impedir_bono_con_pagos();
