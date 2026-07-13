-- ============================================================================
-- Openfit · 002_panel_entrenador.sql
-- Panel del entrenador: función RPC de solo lectura para ver quién se ha
-- apuntado a sus propias clases.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tabla public.reservas ya creada, con RLS
-- y la política "entrenadores ven reservas de sus clases").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función RPC reservas_de_mis_clases()
--    Devuelve, para el entrenador autenticado, las reservas activas de las
--    clases que él mismo ha publicado (nunca de clases de otros
--    entrenadores). Usa %TYPE en la firma para que los tipos de columna
--    coincidan exactamente con los de public.clases y public.reservas, sin
--    tener que adivinarlos aquí.
-- ----------------------------------------------------------------------------
create or replace function public.reservas_de_mis_clases()
returns table (
  reserva_id       uuid,
  clase_id         public.clases.id%type,
  clase_titulo     public.clases.titulo%type,
  clase_fecha      public.clases.fecha%type,
  clase_hora       public.clases.hora%type,
  plazas_max       public.clases.plazas_max%type,
  plazas_ocupadas  public.clases.plazas_ocupadas%type,
  cliente_email    text,
  reservado_en     public.reservas.created_at%type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_rol        text;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  -- 2. Debe ser un usuario con rol "entrenador" (guardado en
  --    user_metadata.rol), mismo patrón que reservar_clase para "cliente".
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = v_usuario_id;

  if v_rol is distinct from 'entrenador' then
    raise exception 'Solo los entrenadores pueden ver esta información.' using errcode = '42501';
  end if;

  -- 3. Solo reservas activas de clases cuyo trainer_id sea el usuario
  --    autenticado. El filtro "c.trainer_id = v_usuario_id" es la única
  --    condición que importa para el aislamiento entre entrenadores: da
  --    igual qué reservas existan en la tabla, esta función nunca puede
  --    devolver una fila cuya clase pertenezca a otro entrenador.
  return query
    select
      r.id as reserva_id,
      c.id as clase_id,
      c.titulo as clase_titulo,
      c.fecha as clase_fecha,
      c.hora as clase_hora,
      c.plazas_max,
      c.plazas_ocupadas,
      u.email::text as cliente_email,
      r.created_at as reservado_en
    from public.reservas r
    join public.clases c on c.id = r.clase_id
    join auth.users u on u.id = r.cliente_id
    where r.estado = 'activa'
      and c.trainer_id = v_usuario_id
    order by c.fecha asc, c.hora asc, r.created_at asc;
end;
$$;

comment on function public.reservas_de_mis_clases() is
  'Devuelve las reservas activas de las clases publicadas por el entrenador autenticado (id de reserva, datos de la clase y email del cliente), ordenadas por fecha/hora de la clase y luego por fecha de reserva. SECURITY DEFINER para poder leer el email en auth.users de forma controlada; el filtro por trainer_id = auth.uid() impide ver clases de otros entrenadores.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: solo usuarios autenticados.
--    Igual que en reservar_clase: se revoca el EXECUTE a PUBLIC que Postgres
--    concede por defecto al crear la función, y se concede solo a
--    authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.reservas_de_mis_clases() from public;
grant execute on function public.reservas_de_mis_clases() to authenticated;
