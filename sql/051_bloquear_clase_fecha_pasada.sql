-- 051_bloquear_clase_fecha_pasada.sql
-- Red de seguridad: impide insertar una clase con fecha+hora ya pasada
-- (hora local Europe/Madrid). Complementa la validacion del cliente en /publicar.

create or replace function public.validar_clase_no_pasada()
returns trigger
language plpgsql
as $$
declare
  v_inicio timestamp;
  v_ahora  timestamp;
begin
  v_inicio := (new.fecha::text || ' ' || new.hora::text)::timestamp;
  v_ahora  := (now() at time zone 'Europe/Madrid');
  if v_inicio < v_ahora then
    raise exception 'No se puede crear una sesión con fecha y hora ya pasada.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_clase_no_pasada on public.clases;
create trigger trg_validar_clase_no_pasada
  before insert on public.clases
  for each row
  execute function public.validar_clase_no_pasada();
