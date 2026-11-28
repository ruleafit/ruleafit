-- Reversión de 114. Se niega si ya hay liquidaciones: son registros contables. Repetible.
do $$
begin
  if exists (select 1 from public.liquidaciones_lineas) then
    raise exception 'Hay liquidaciones registradas: no se revierte 114.';
  end if;
end;
$$;
drop function if exists public.datos_transferencia(uuid);
drop function if exists public.marcar_linea_liquidacion(uuid, text);
drop function if exists public.cerrar_liquidacion();
drop function if exists public.panel_liquidaciones();
drop function if exists public.liquidacion_calcular(date);
drop function if exists public.liquidacion_cobros(date);
drop function if exists public.liquidacion_periodo(date);
alter table public.liquidaciones_lineas drop constraint if exists liquidaciones_lineas_estado_check;
alter table public.liquidaciones_lineas add constraint liquidaciones_lineas_estado_check check (estado in ('pendiente', 'pagada'));
alter table public.cobros drop column if exists liquidacion_id;
alter table public.config_pagos drop column if exists liquidar_bonos_en_plazo;
