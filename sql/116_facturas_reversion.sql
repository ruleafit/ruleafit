-- Reversión de 116. Se niega si hay facturas emitidas: son registros fiscales. Repetible.
do $$
begin
  if to_regclass('public.facturas') is not null and exists (select 1 from public.facturas where estado <> 'borrador') then
    raise exception 'Hay facturas emitidas: no se revierte 116.';
  end if;
end;
$$;
drop function if exists public.mis_facturas();
drop function if exists public.emitir_factura(uuid);
drop function if exists public.generar_borradores_facturas();
drop function if exists public.comisiones_sin_facturar();
alter table public.cobros drop column if exists factura_comision_id;
drop table if exists public.facturas;
drop table if exists public.facturas_contadores;
drop function if exists public.factura_emitida_inmutable();
alter table public.config_pagos
  drop column if exists facturas_validadas, drop column if exists factura_iva_bps, drop column if exists factura_ruleafit;
