-- ⛔ SOLO EN EL PROYECTO DE PRUEBAS (ixeuanoikjftpdgezfyz). Borra los bonos anteriores a la venta online.
-- No hace nada si los pagos no están activos en la base (en producción están apagados).
do $$
begin
  if not exists (select 1 from public.config_pagos where id and pagos_activos) then
    raise exception 'ALTO: esta base tiene los pagos apagados: no parece la de pruebas. No se ha borrado nada.';
  end if;
end;
$$;
delete from public.bonos where reglas_version is distinct from 2;
select count(*) as bonos_que_quedan from public.bonos;
