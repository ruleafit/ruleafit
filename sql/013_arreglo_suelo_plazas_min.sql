-- ============================================================================
-- Ruleafit · 013_arreglo_suelo_plazas_min.sql
-- Corrige un bloqueo detectado en editar_clase() (sql/012_editar_clase.sql)
-- al construir la página de edición del cliente.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- EL PROBLEMA: editar_clase() exige a la vez que "plazas_min solo puede
-- bajar, nunca subir" y que "plazas_min nunca puede ser menor que 1". Para
-- cualquier clase publicada SIN mínimo (plazas_min = 0, el caso normal desde
-- que se decidió dejarlo así, ver PROGRESS.md), estas dos reglas juntas no
-- dejan ningún valor válido:
--   - Enviar 0 (sin tocarlo) incumple "no puede ser menor que 1".
--   - Enviar 1 o más incumple "no puede subir desde 0".
-- El resultado es que ninguna clase sin mínimo se puede editar en absoluto
-- (ni siquiera para cambiar el título), porque la función siempre recibe
-- algún valor de plazas_min y ese valor siempre incumple una de las dos
-- reglas.
--
-- LA CORRECCIÓN: el suelo de 1 solo tiene sentido cuando la clase YA tenía
-- un mínimo (plazas_min > 0): en ese caso, bajarlo hasta 0 significaría
-- quitar el mínimo por esta vía, que no es lo que se pidió (solo se pidió
-- poder reducirlo, no eliminarlo), así que se mantiene el suelo en 1. Pero
-- si la clase no tenía mínimo (plazas_min = 0), no hay nada que "bajar": el
-- único valor que tiene sentido aceptar es 0 sin cambios, y precisamente
-- eso es lo que ya garantiza la regla "no puede subir desde 0" (cualquier
-- valor mayor que 0 ya se rechaza ahí). Por tanto, el suelo de 1 debe
-- aplicarse SOLO cuando el mínimo actual ya era mayor que 0.
--
-- Se repite la función completa porque CREATE OR REPLACE sustituye el
-- cuerpo entero; el resto de comprobaciones (propiedad, cancelada, pasada,
-- umbral de 2h, dirección de plazas_max, coherencia final, columnas que se
-- actualizan) queda exactamente igual que en sql/012_editar_clase.sql.
-- ============================================================================


create or replace function public.editar_clase(
  p_clase_id         uuid,
  p_titulo           public.clases.titulo%type,
  p_modalidad        public.clases.modalidad%type,
  p_categoria        public.clases.categoria%type,
  p_nivel            public.clases.nivel%type,
  p_material         public.clases.material%type,
  p_observaciones    public.clases.observaciones%type,
  p_punto_encuentro  public.clases.punto_encuentro%type,
  p_plazas_min       public.clases.plazas_min%type,
  p_plazas_max       public.clases.plazas_max%type
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id   uuid;
  v_clase        record;
  v_clase_inicio timestamp;
  v_ahora_local  timestamp;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para editar una clase.' using errcode = '28000';
  end if;

  -- 2. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, mismo patrón que reservar_clase/cancelar_clase,
  --    para que dos ediciones simultáneas de la misma clase no se pisen.
  select id, trainer_id, estado, fecha, hora, plazas_min, plazas_max
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 3. La clase debe pertenecer al entrenador autenticado. Única
  --    comprobación que importa para el aislamiento entre entrenadores,
  --    mismo patrón que cancelar_clase()/reservas_de_mis_clases().
  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes editar tus propias clases.' using errcode = '42501';
  end if;

  -- 4. No se puede editar una clase cancelada.
  if v_clase.estado <> 'activa' then
    raise exception 'No se puede editar una clase cancelada.' using errcode = 'P0001';
  end if;

  -- 5. No se puede editar una clase que ya ha empezado o ha pasado (mismo
  --    criterio de fecha+hora exacta en hora local de España que usan
  --    reservar_clase/cancelar_reserva/cancelar_clase/marcar_asistencia).
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'No se puede editar una clase que ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 6. No se puede editar a menos de 2 horas del comienzo (mismo umbral que
  --    calcula cancelar_reserva() para reembolso_aplicable, aquí como
  --    bloqueo duro en vez de informativo).
  if (v_clase_inicio - v_ahora_local) < interval '2 hours' then
    raise exception 'No se puede editar una clase a menos de 2 horas de su comienzo.' using errcode = 'P0001';
  end if;

  -- 7. plazas_min solo puede bajar (nunca subir). El suelo de 1 se exige
  --    SOLO cuando la clase ya tenía un mínimo (v_clase.plazas_min > 0):
  --    en ese caso no se permite vaciarlo del todo por esta vía, hay que
  --    dejarlo al menos en 1. Si la clase no tenía mínimo (plazas_min = 0),
  --    no se exige el suelo — el único valor que tiene sentido en ese caso
  --    es 0 sin cambios, y ese valor ya queda garantizado por la
  --    comprobación de "no puede subir desde 0" de la línea siguiente.
  --    Sin esta excepción, ninguna clase sin mínimo podría editarse nunca
  --    (0 incumpliría el suelo, y cualquier valor >= 1 incumpliría "no
  --    puede subir"): no habría ningún valor de plazas_min válido.
  if p_plazas_min > v_clase.plazas_min then
    raise exception 'Las plazas mínimas solo se pueden reducir, no aumentar.' using errcode = 'P0001';
  end if;

  if v_clase.plazas_min > 0 and p_plazas_min < 1 then
    raise exception 'Las plazas mínimas no pueden ser menores que 1.' using errcode = 'P0001';
  end if;

  -- 8. plazas_max solo puede subir (nunca bajar): bajarlo podría dejar
  --    fuera a personas que ya reservaron con la clase llena hasta ese
  --    punto.
  if p_plazas_max < v_clase.plazas_max then
    raise exception 'Las plazas máximas solo se pueden aumentar, no reducir.' using errcode = 'P0001';
  end if;

  -- 9. Coherencia final entre plazas mínimas y máximas (mismo CHECK que ya
  --    exige la tabla, clases_plazas_min_rango de
  --    sql/007_minimo_y_cancelar_clase.sql); se comprueba aquí también para
  --    devolver un mensaje claro en vez de un error genérico de restricción
  --    si alguien pidiera, por ejemplo, subir el máximo pero dejar el
  --    mínimo por encima de él.
  if p_plazas_min > p_plazas_max then
    raise exception 'Las plazas mínimas no pueden superar a las plazas máximas.' using errcode = 'P0001';
  end if;

  -- 10. Actualizar solo las columnas editables. Fecha, hora, duración,
  --     ciudad, dirección, coordenadas y precio no aparecen aquí a
  --     propósito: no forman parte ni de los parámetros de la función.
  update public.clases
    set titulo          = p_titulo,
        modalidad       = p_modalidad,
        categoria       = p_categoria,
        nivel           = p_nivel,
        material        = p_material,
        observaciones   = p_observaciones,
        punto_encuentro = p_punto_encuentro,
        plazas_min      = p_plazas_min,
        plazas_max      = p_plazas_max
    where id = p_clase_id;

  -- 11. Resultado claro de éxito, con los valores finales de plazas para
  --     que el cliente pueda reflejar exactamente lo que quedó guardado
  --     sin tener que volver a consultar.
  return jsonb_build_object(
    'ok', true,
    'clase_id', p_clase_id,
    'plazas_min', p_plazas_min,
    'plazas_max', p_plazas_max
  );
end;
$$;

comment on function public.editar_clase(uuid, text, text, text, text, text, text, text, integer, integer) is
  'Edita los campos editables de una clase ya publicada por el entrenador autenticado (título, modalidad, categoría, nivel, material, observaciones, punto de encuentro, y plazas_min/plazas_max con restricción de dirección: min solo baja, con suelo en 1 únicamente si ya tenía mínimo antes; max solo sube). Rechaza si la clase no es del entrenador, está cancelada, ya ha pasado, o falta menos de 2h para su inicio. Nunca modifica fecha, hora, duración, ciudad, dirección, coordenadas ni precio: no forman parte de la firma de la función. SECURITY DEFINER con bloqueo de fila (FOR UPDATE), mismo patrón que cancelar_clase().';

-- Permisos de ejecución sin cambios respecto a sql/012 (ya concedidos a
-- authenticated); CREATE OR REPLACE no los toca ni los borra, así que no
-- hace falta repetir el revoke/grant.


-- ============================================================================
-- COMPROBACIÓN (ejecutar a mano después de lanzar el bloque anterior)
-- ============================================================================

-- a) Sobre una clase de prueba que YA tenía plazas_min = 0 ("sin mínimo"):
--    esta llamada debe funcionar ahora (antes fallaba siempre). Sustituye
--    el resto de valores por los datos reales de esa clase si quieres
--    comprobar también que el resto de campos se guardan bien:
-- select public.editar_clase(
--   '<uuid de la clase de prueba con plazas_min = 0>',
--   'Título de prueba', 'Modalidad', 'Categoría', 'Nivel',
--   'Material', 'Observaciones', 'Punto de encuentro',
--   0,   -- plazas_min sin cambios, debe aceptarse ahora
--   10
-- );

-- b) Sobre esa misma clase, confirmar que sigue sin poder "inventarse" un
--    mínimo por esta vía (debe seguir fallando con "no se pueden aumentar"):
-- select public.editar_clase(
--   '<uuid de la clase de prueba con plazas_min = 0>',
--   'Título de prueba', 'Modalidad', 'Categoría', 'Nivel',
--   'Material', 'Observaciones', 'Punto de encuentro',
--   1,   -- intenta subir desde 0, debe rechazar
--   10
-- );

-- c) Sobre una clase de prueba que YA tenía un mínimo mayor que 0, confirmar
--    que el suelo de 1 se sigue exigiendo (debe fallar con "no pueden ser
--    menores que 1"):
-- select public.editar_clase(
--   '<uuid de la clase de prueba con plazas_min > 0>',
--   'Título de prueba', 'Modalidad', 'Categoría', 'Nivel',
--   'Material', 'Observaciones', 'Punto de encuentro',
--   0,   -- intenta vaciar el mínimo existente, debe rechazar
--   10
-- );
