-- ============================================================================
-- Ruleafit · 012_editar_clase.sql
-- Edición de clases ya publicadas por el entrenador (Paso 1 del plan:
-- función RPC; el cliente —página /mis-clases/[id]/editar y botón "Editar"
-- en /mis-clases— se hace en pasos posteriores, no en este archivo).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Por qué una función RPC y no un UPDATE directo protegido por RLS: las
-- reglas de negocio (plazas_min solo puede bajar, plazas_max solo puede
-- subir, umbral de 2h, no editable si está pasada o cancelada) necesitan
-- comparar el valor nuevo contra el valor ACTUAL de la fila en el momento de
-- escribir, y eso no se puede expresar de forma segura y sencilla en una
-- política RLS de UPDATE (obligaría a subconsultas sobre la propia tabla,
-- el mismo patrón que causó la recursión corregida en
-- sql/010_arreglo_recursion_rls.sql). Además, todas las demás escrituras
-- sobre clases/reservas (reservar_clase, cancelar_reserva, cancelar_clase,
-- marcar_asistencia) ya usan este patrón de función SECURITY DEFINER con
-- bloqueo de fila; esta función lo mantiene por consistencia.
--
-- Nota aparte (para anotar en PROGRESS.md más adelante, no en este
-- archivo): la tabla public.clases y sus políticas RLS iniciales (SELECT,
-- INSERT) no están versionadas en ningún archivo de sql/ — se crearon
-- directamente en el editor de Supabase antes de empezar a versionar el
-- SQL del proyecto. Por eso esta función usa SECURITY DEFINER: al escribir
-- con los privilegios del propietario, no depende de si existe o no una
-- política de UPDATE sobre clases (que no está documentada en el repo).
--
-- Depende de sql/001_reservas.sql (tabla public.clases, criterio de
-- fecha+hora exacta en Europe/Madrid) y sql/007_minimo_y_cancelar_clase.sql
-- (columna plazas_min). Mismo patrón de bloqueo de fila (FOR UPDATE) y
-- validación de propiedad que sql/007/008 (cancelar_clase) y
-- sql/003_cancelaciones.sql (cancelar_reserva).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Función RPC editar_clase(...)
-- Actualiza SOLO los campos editables de una clase ya publicada por el
-- entrenador autenticado. Nunca recibe ni toca fecha, hora, duracion,
-- ciudad, direccion, lat, lng ni precio: al no formar parte de la firma de
-- la función, es imposible modificarlos por esta vía aunque el cliente
-- intentara enviarlos.
-- ----------------------------------------------------------------------------
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

  -- 7. plazas_min solo puede bajar (nunca subir), con suelo en 1. Bajarlo
  --    solo puede beneficiar a los ya apuntados (confirma antes la clase),
  --    por eso se permite; subirlo podría dejar "pendiente de confirmación"
  --    una clase que ya estaba confirmada para quienes reservaron confiando
  --    en ello.
  if p_plazas_min > v_clase.plazas_min then
    raise exception 'Las plazas mínimas solo se pueden reducir, no aumentar.' using errcode = 'P0001';
  end if;

  if p_plazas_min < 1 then
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
  'Edita los campos editables de una clase ya publicada por el entrenador autenticado (título, modalidad, categoría, nivel, material, observaciones, punto de encuentro, y plazas_min/plazas_max con restricción de dirección: min solo baja con suelo en 1, max solo sube). Rechaza si la clase no es del entrenador, está cancelada, ya ha pasado, o falta menos de 2h para su inicio. Nunca modifica fecha, hora, duración, ciudad, dirección, coordenadas ni precio: no forman parte de la firma de la función. SECURITY DEFINER con bloqueo de fila (FOR UPDATE), mismo patrón que cancelar_clase().';

-- 12. Permisos de ejecución: solo usuarios autenticados, mismo patrón que
--     el resto de funciones RPC del proyecto.
revoke all on function public.editar_clase(uuid, text, text, text, text, text, text, text, integer, integer) from public;
grant execute on function public.editar_clase(uuid, text, text, text, text, text, text, text, integer, integer) to authenticated;


-- ============================================================================
-- COMPROBACIÓN (ejecutar a mano después de lanzar el bloque anterior)
-- ============================================================================

-- a) Confirmar que la función se creó con la firma esperada (10 parámetros):
-- select proname, pronargs
-- from pg_proc
-- where proname = 'editar_clase';

-- b) Antes/después de probar una edición manual sobre una clase de prueba,
--    esta consulta muestra el estado completo de la fila para comprobar que
--    solo cambiaron los campos editables y que fecha/hora/duración/ciudad/
--    dirección/coordenadas/precio siguen exactamente igual:
-- select
--   id, titulo, modalidad, categoria, nivel, material, observaciones,
--   punto_encuentro, plazas_min, plazas_max,
--   fecha, hora, duracion, ciudad, direccion, lat, lng, precio, estado
-- from public.clases
-- where id = '<uuid de la clase de prueba>';

-- c) Para probar el rechazo por dirección de plazas (debe fallar con el
--    mensaje "Las plazas mínimas solo se pueden reducir, no aumentar." o
--    "Las plazas máximas solo se pueden aumentar, no reducir."), llama a
--    la función con un plazas_min mayor que el actual, o un plazas_max
--    menor que el actual:
-- select public.editar_clase(
--   '<uuid de la clase de prueba>',
--   'Título de prueba', 'Modalidad', 'Categoría', 'Nivel',
--   'Material', 'Observaciones', 'Punto de encuentro',
--   999,  -- plazas_min a propósito mayor que el actual, debe rechazar
--   10
-- );
