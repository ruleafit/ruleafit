-- ============================================================================
-- Ruleafit · 054_mis_clases_motivo_cancelacion.sql
-- mis_clases() no devuelve motivo_cancelacion (columna añadida en
-- sql/031_motivo_cancelacion.sql), así que el front (app/mis-clases/page.js)
-- no tiene forma de distinguir una clase cancelada por el entrenador de una
-- autocancelada por no alcanzar el mínimo. Se añade la columna al resultado
-- de la RPC.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/011_panel_entrenador_y_contador.sql (versión vigente de
-- mis_clases, que es la que se recrea aquí entera) y sql/031 (columna
-- motivo_cancelacion). Añadir una columna al RETURNS TABLE cambia el tipo de
-- retorno de la función; Postgres no permite eso con CREATE OR REPLACE
-- FUNCTION (mismo tipo de restricción que ya documentó
-- sql/018_arreglo_editar_clase_drop.sql para un cambio de parámetro de
-- entrada), así que hace falta DROP FUNCTION previo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) DROP previo: obligatorio porque cambia el RETURNS TABLE (columnas de
--    salida). La firma de entrada es "sin parámetros", así que
--    "public.mis_clases()" identifica la función sin ambigüedad.
-- ----------------------------------------------------------------------------
drop function if exists public.mis_clases();


-- ----------------------------------------------------------------------------
-- 2) Recrear mis_clases() con motivo_cancelacion añadido, junto a estado.
--    Resto de la función idéntico a sql/011 (validación de rol entrenador,
--    LEFT JOIN a reservas, filtro por trainer_id, group by, order by,
--    SECURITY DEFINER, search_path).
-- ----------------------------------------------------------------------------
create or replace function public.mis_clases()
returns table (
  clase_id            public.clases.id%type,
  titulo              public.clases.titulo%type,
  categoria           public.clases.categoria%type,
  fecha               public.clases.fecha%type,
  hora                public.clases.hora%type,
  plazas_max          public.clases.plazas_max%type,
  plazas_min          public.clases.plazas_min%type,
  plazas_ocupadas     public.clases.plazas_ocupadas%type,
  estado              public.clases.estado%type,
  motivo_cancelacion  public.clases.motivo_cancelacion%type,
  reservas_activas    bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_rol        text;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = v_usuario_id;

  if v_rol is distinct from 'entrenador' then
    raise exception 'Solo los entrenadores pueden ver esta información.' using errcode = '42501';
  end if;

  return query
    select
      c.id as clase_id,
      c.titulo,
      c.categoria,
      c.fecha,
      c.hora,
      c.plazas_max,
      c.plazas_min,
      c.plazas_ocupadas,
      c.estado,
      c.motivo_cancelacion,
      count(r.id) filter (where r.estado = 'activa') as reservas_activas
    from public.clases c
    left join public.reservas r on r.clase_id = c.id
    where c.trainer_id = v_usuario_id
    group by c.id
    order by c.fecha asc, c.hora asc;
end;
$$;

comment on function public.mis_clases() is
  'Devuelve todas las clases publicadas por el entrenador autenticado (tengan o no reservas, sea cual sea su estado), con el recuento de reservas activas de cada una y motivo_cancelacion (NULL si no está cancelada o se canceló manualmente, ''minimo'' si se autocanceló por no alcanzar el mínimo). SECURITY DEFINER para poder leer clases propias que la política RLS normal no dejaría ver (p.ej. canceladas); el filtro por trainer_id = auth.uid() impide ver clases de otros entrenadores. No sustituye a reservas_de_mis_clases(), que sigue siendo la fuente del listado de alumnos por clase.';


-- ----------------------------------------------------------------------------
-- 3) Permisos de ejecución: el DROP FUNCTION borra también los permisos
--    concedidos antes, así que hay que volver a concederlos explícitamente
--    (a diferencia de un CREATE OR REPLACE normal, que sí los conserva). Sin
--    este bloque la RPC dejaría de ser accesible desde el cliente.
-- ----------------------------------------------------------------------------
revoke all on function public.mis_clases() from public;
grant execute on function public.mis_clases() to authenticated;
