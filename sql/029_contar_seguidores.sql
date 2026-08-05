-- 029_contar_seguidores.sql
-- Devuelve cuántos clientes siguen al entrenador que hace la llamada.
-- SECURITY DEFINER: el recuento solo se devuelve para uno mismo (auth.uid()),
-- así el dato queda protegido en servidor y no depende de ocultarlo en la UI.
create or replace function public.contar_mis_seguidores()
returns integer
language sql
security definer
set search_path = public
as $$
    select count(*)::integer
    from public.seguimientos
    where entrenador_id = auth.uid();
$$;

revoke all on function public.contar_mis_seguidores() from public;
grant execute on function public.contar_mis_seguidores() to authenticated;
