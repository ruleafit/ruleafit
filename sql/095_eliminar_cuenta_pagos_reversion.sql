-- Reversión de 095: restaura la función de sql/068. NO vuelve a crear las FK a
-- auth.users (podría haber uuids huérfanos) ni borra archivo_fiscal (datos a conservar).
create or replace function public.eliminar_mi_cuenta()
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_ahora   timestamp := (now() at time zone 'Europe/Madrid');
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if exists (
    select 1 from public.clases c join public.reservas r on r.clase_id = c.id
     where c.trainer_id = v_usuario and c.estado = 'activa' and r.estado = 'activa'
       and (c.fecha::text || ' ' || c.hora::text)::timestamp > v_ahora
  ) then
    raise exception 'Tienes sesiones próximas con reservas. Cancélalas antes de eliminar tu cuenta.' using errcode = 'P0001';
  end if;
  update public.clases c set plazas_ocupadas = greatest(c.plazas_ocupadas - 1, 0)
    from public.reservas r
   where r.clase_id = c.id and r.cliente_id = v_usuario and r.estado = 'activa' and c.estado = 'activa';
  update public.rulos_movimientos set otorgado_por = null where otorgado_por = v_usuario;
  update public.reservas set asistencia_marcada_por = null where asistencia_marcada_por = v_usuario;
  delete from auth.users where id = v_usuario;
end;
$$;
revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
