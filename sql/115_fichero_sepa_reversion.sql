-- Reversión de 115. Se niega si ya se ha enviado algún fichero. Antes: 115_fichero_sepa_cron_baja.sql. Repetible.
do $$
begin
  if to_regclass('public.ficheros_sepa') is not null and exists (select 1 from public.ficheros_sepa where estado = 'enviado') then
    raise exception 'Hay ficheros enviados al banco: no se revierte 115.';
  end if;
end;
$$;
drop trigger if exists trg_linea_sale_del_fichero on public.liquidaciones_lineas;
drop function if exists public.linea_sale_del_fichero();
drop function if exists public.panel_ficheros_sepa();
drop function if exists public.cerrar_fichero_sepa(uuid, text);
drop function if exists public.datos_fichero_sepa(uuid);
drop function if exists public.preparar_fichero_sepa();
drop function if exists public.lineas_para_fichero();
alter table public.liquidaciones_lineas drop column if exists fichero_id;
drop table if exists public.ficheros_sepa;
