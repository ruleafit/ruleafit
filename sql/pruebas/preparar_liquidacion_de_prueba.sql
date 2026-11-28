-- ⛔ SOLO EN LA BASE DE PRUEBAS. Prepara datos para probar liquidaciones y facturas (pasos 3 a 5):
--  1) el saldo ya liberado pasa a contar como liberado antes del último corte;
--  2) pone datos fiscales INVENTADOS de Ruleafit en los borradores de factura (no activa la facturación).
do $$
declare
  v_corte date;
begin
  if not (select pagos_activos from public.config_pagos where id) then
    raise exception 'Los pagos están apagados: esta no parece la base de pruebas. No se ha cambiado nada.';
  end if;
  select fin into v_corte from public.liquidacion_periodo((now() at time zone 'Europe/Madrid')::date);
  update public.cobros set liberado_en = (v_corte - 1)::timestamp + interval '12 hours'
   where liberado_en is not null and liquidacion_id is null;
  update public.config_pagos
     set factura_ruleafit = '{"nombre":"Ruleafit Pruebas (inventada)","nif":"B00000000","direccion":"Calle Inventada 1, Sevilla"}'
   where id;
end;
$$;
select count(*) as cobros_listos, coalesce(sum(neto_centimos), 0) as neto_centimos
  from public.cobros where liberado_en is not null and liquidacion_id is null and estado in ('pagado', 'reembolsado_parcial');
