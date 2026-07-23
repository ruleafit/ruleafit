-- ============================================================================
-- Openfit · 011_panel_entrenador_y_contador.sql
-- Dos correcciones al panel del entrenador, detectadas al usar /mis-clases:
--
-- 1) reservas_de_mis_clases() arranca desde public.reservas (JOIN normal con
--    public.clases), así que una clase recién publicada y sin ninguna
--    reserva activa no genera ninguna fila y nunca aparece en /mis-clases.
--    Se añade una función NUEVA, mis_clases(), que arranca desde
--    public.clases con LEFT JOIN a reservas: siempre devuelve una fila por
--    clase del entrenador, tenga o no reservas. reservas_de_mis_clases() NO
--    se toca: sigue siendo el listado de alumnos por clase que ya usa
--    /mis-clases para la lista de asistencia.
--
--    Se descarta la alternativa de modificar reservas_de_mis_clases() para
--    que ella misma haga el LEFT JOIN, porque cambiaría su contrato actual
--    (hoy cada fila es una reserva real; con LEFT JOIN, una clase sin
--    reservas generaría una fila "fantasma" con reserva_id/cliente_username/
--    asistencia en NULL) y mezclaría dos responsabilidades — "mis clases" y
--    "alumnos de mis clases" — en una función pensada para una sola cosa.
--    Mantener reservas_de_mis_clases() intacta evita ese riesgo sobre código
--    ya usado en producción.
--
-- 2) cancelar_clase() (sql/007_minimo_y_cancelar_clase.sql, actualizada en
--    sql/008_aviso_cancelacion_entrenador.sql) cancela en bloque todas las
--    reservas activas de la clase pero nunca toca clases.plazas_ocupadas, así
--    que el contador se queda congelado con el valor previo a la
--    cancelación en vez de reflejar que ya no queda ninguna reserva activa.
--    Se corrige poniendo plazas_ocupadas a 0 en el mismo UPDATE que marca la
--    clase como cancelada (es el valor correcto siempre: esta función acaba
--    de cancelar TODAS las reservas activas de esa clase, así que el
--    recuento de activas pasa a ser 0 sin excepción, sea cual sea el valor
--    que tuviera el contador antes).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit"). Cada bloque puede lanzarse por separado en
-- el editor SQL. Usa CREATE OR REPLACE en ambos casos (misma lista de
-- columnas/parámetros que ya existen), así que relanzar este archivo entero
-- es seguro y no rompe nada si ya se ejecutó antes.
--
-- Depende de sql/001_reservas.sql (tablas clases/reservas), sql/002 (patrón
-- de reservas_de_mis_clases), sql/006 (versión vigente de
-- reservas_de_mis_clases, sin tocar aquí) y sql/007+008 (cancelar_clase).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función RPC mis_clases()
--    Devuelve, para el entrenador autenticado, TODAS sus clases (tengan o no
--    reservas, y sea cual sea su estado), con el recuento de reservas
--    activas de cada una. SECURITY DEFINER porque la política RLS de
--    public.clases ("Ver clases activas", sql/010_arreglo_recursion_rls.sql)
--    solo deja ver filas con estado = 'activa' (o con reserva propia), y un
--    entrenador debe poder ver también sus propias clases canceladas; el
--    filtro "c.trainer_id = v_usuario_id" de más abajo es la única condición
--    que importa para que nadie vea clases ajenas, mismo patrón que
--    reservas_de_mis_clases() y cancelar_clase().
-- ----------------------------------------------------------------------------
create or replace function public.mis_clases()
returns table (
  clase_id         public.clases.id%type,
  titulo           public.clases.titulo%type,
  categoria        public.clases.categoria%type,
  fecha            public.clases.fecha%type,
  hora             public.clases.hora%type,
  plazas_max       public.clases.plazas_max%type,
  plazas_min       public.clases.plazas_min%type,
  plazas_ocupadas  public.clases.plazas_ocupadas%type,
  estado           public.clases.estado%type,
  reservas_activas bigint
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
  --    user_metadata.rol), mismo patrón que reservas_de_mis_clases().
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = v_usuario_id;

  if v_rol is distinct from 'entrenador' then
    raise exception 'Solo los entrenadores pueden ver esta información.' using errcode = '42501';
  end if;

  -- 3. Todas las clases cuyo trainer_id sea el usuario autenticado, con el
  --    recuento de reservas activas de cada una. LEFT JOIN (en vez del JOIN
  --    normal de reservas_de_mis_clases) para que una clase sin ninguna
  --    reserva todavía devuelva una fila igualmente, con reservas_activas en
  --    0 en vez de desaparecer. El filtro "c.trainer_id = v_usuario_id" es
  --    la única condición que importa para el aislamiento entre
  --    entrenadores.
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
      count(r.id) filter (where r.estado = 'activa') as reservas_activas
    from public.clases c
    left join public.reservas r on r.clase_id = c.id
    where c.trainer_id = v_usuario_id
    group by c.id
    order by c.fecha asc, c.hora asc;
end;
$$;

comment on function public.mis_clases() is
  'Devuelve todas las clases publicadas por el entrenador autenticado (tengan o no reservas, sea cual sea su estado), con el recuento de reservas activas de cada una. SECURITY DEFINER para poder leer clases propias que la política RLS normal no dejaría ver (p.ej. canceladas); el filtro por trainer_id = auth.uid() impide ver clases de otros entrenadores. No sustituye a reservas_de_mis_clases(), que sigue siendo la fuente del listado de alumnos por clase.';

-- Permisos de ejecución: solo usuarios autenticados, mismo patrón que el
-- resto de funciones RPC del proyecto.
revoke all on function public.mis_clases() from public;
grant execute on function public.mis_clases() to authenticated;


-- ----------------------------------------------------------------------------
-- 2) cancelar_clase(): añade "plazas_ocupadas = 0" al UPDATE que marca la
--    clase como cancelada. Resto de la función idéntico a la versión vigente
--    (sql/008_aviso_cancelacion_entrenador.sql); se repite entera porque
--    CREATE OR REPLACE sustituye el cuerpo completo.
-- ----------------------------------------------------------------------------
create or replace function public.cancelar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id           uuid;
  v_clase                record;
  v_clase_inicio         timestamp;
  v_ahora_local          timestamp;
  v_reservas_canceladas  integer;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para cancelar una clase.' using errcode = '28000';
  end if;

  -- 2. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, igual que reservar_clase/cancelar_reserva.
  select id, trainer_id, estado, fecha, hora
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 3. La clase debe pertenecer al entrenador autenticado. Esta es la única
  --    comprobación que importa para que nadie pueda cancelar (ni ver el
  --    resultado de intentarlo sobre) una clase ajena: da igual qué
  --    p_clase_id se pase, si su trainer_id no coincide con auth.uid() la
  --    función rechaza antes de escribir nada, mismo patrón que
  --    marcar_asistencia() y reservas_de_mis_clases().
  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes cancelar tus propias clases.' using errcode = '42501';
  end if;

  -- 4. No se puede cancelar dos veces.
  if v_clase.estado <> 'activa' then
    raise exception 'Esta clase ya está cancelada.' using errcode = 'P0001';
  end if;

  -- 5. No se puede cancelar una clase que ya ha empezado o ha pasado (mismo
  --    criterio de fecha+hora exacta en hora local de España que usan
  --    reservar_clase/cancelar_reserva/marcar_asistencia).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede cancelar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 6. Marcar la clase como cancelada Y poner plazas_ocupadas a 0 en el
  --    mismo UPDATE: esta función va a cancelar a continuación TODAS las
  --    reservas activas de la clase (paso 7), así que el recuento de
  --    reservas activas pasa a ser 0 sin excepción — es el valor correcto
  --    sea cual sea el que tuviera el contador antes, y corrige de paso
  --    cualquier descuadre previo que arrastrara la clase.
  update public.clases
    set estado = 'cancelada',
        plazas_ocupadas = 0
    where id = p_clase_id;

  -- 7. Marcar como canceladas, de golpe, todas las reservas activas de esta
  --    clase (mismo campo cancelled_at que usa cancelar_reserva() para una
  --    reserva individual), y cancelada_por_entrenador = true para que el
  --    cliente pueda distinguir esta cancelación de una hecha por él mismo
  --    (cancelar_reserva() no toca esta columna, se queda en false).
  --    GET DIAGNOSTICS recoge cuántas filas afectó el UPDATE para poder
  --    informar al entrenador.
  update public.reservas
    set estado = 'cancelada',
        cancelled_at = now(),
        cancelada_por_entrenador = true
    where clase_id = p_clase_id
      and estado = 'activa';

  get diagnostics v_reservas_canceladas = row_count;

  -- 8. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'clase_id', p_clase_id,
    'reservas_canceladas', v_reservas_canceladas
  );
end;
$$;

comment on function public.cancelar_clase(uuid) is
  'Cancela una clase entera del entrenador autenticado de forma atómica: valida propiedad de la clase (trainer_id = auth.uid()), que no esté ya cancelada y que no haya empezado, bloquea la fila de la clase para evitar condiciones de carrera, marca la clase como cancelada con plazas_ocupadas a 0 (ya no queda ninguna reserva activa) y cancela de golpe todas las reservas activas asociadas marcándolas con cancelada_por_entrenador = true (para que el cliente distinga esta cancelación de una hecha por él mismo), sin cargo ni devolución real todavía. Devuelve cuántas reservas se cancelaron.';

-- Permisos de ejecución sin cambios respecto a sql/008 (ya concedidos a
-- authenticated); CREATE OR REPLACE no los toca ni los borra, así que no
-- hace falta repetir el revoke/grant.


-- ============================================================================
-- COMPROBACIÓN (ejecutar a mano después de lanzar los dos bloques anteriores)
-- ============================================================================

-- a) mis_clases() debe devolver todas tus clases, incluida cualquiera sin
--    reservas todavía (reservas_activas en 0), a diferencia de
--    reservas_de_mis_clases() que seguirá sin devolver esas filas:
-- select * from public.mis_clases();

-- b) Tras cancelar una clase de prueba con reservas activas (o revisando una
--    ya cancelada), esta consulta debe devolver 0 filas: comprueba que para
--    toda clase cancelada, plazas_ocupadas coincide con el recuento real de
--    reservas activas (que debe ser 0):
-- select
--   c.id,
--   c.titulo,
--   c.plazas_ocupadas,
--   count(r.id) filter (where r.estado = 'activa') as reservas_activas_reales
-- from public.clases c
-- left join public.reservas r on r.clase_id = c.id
-- where c.estado = 'cancelada'
-- group by c.id, c.titulo, c.plazas_ocupadas
-- having c.plazas_ocupadas <> count(r.id) filter (where r.estado = 'activa');
