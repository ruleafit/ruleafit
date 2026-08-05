-- 030_listar_entrenadores.sql
-- Lista los entrenadores REALES (por rol en auth.users), para el buscador de clientes.
-- SECURITY DEFINER porque necesita leer el rol desde auth.users, que no es accesible
-- directamente. Devuelve SOLO columnas públicas de perfiles (nunca datos de auth.users).
-- Permiso solo a authenticated: el buscador es para clientes logueados.
create or replace function public.listar_entrenadores()
returns table (
    id          uuid,
    username    text,
    descripcion text,
    foto_url    text
)
language sql
security definer
set search_path = public
as $$
    select p.id, p.username, p.descripcion, p.foto_url
    from public.perfiles p
    join auth.users u on u.id = p.id
    where u.raw_user_meta_data->>'rol' = 'entrenador'
    order by p.username asc;
$$;

revoke all on function public.listar_entrenadores() from public;
grant execute on function public.listar_entrenadores() to authenticated;
