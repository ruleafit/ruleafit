-- ============================================================================
-- Ruleafit · 080_avisos_zona_evaluacion.sql
-- «Avisos de sesiones en mi zona» · FASE 3: evaluación en seco.
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el SQL
-- Editor de Supabase (proyecto "ruleafit"), previa autorización expresa.
--
-- QUÉ HACE: crea UNA función de SOLO LECTURA,
--     public.avisos_zona_evaluar(p_clase_id, p_ahora, p_detalle)
-- que responde: "si esta sesión se acabara de publicar, ¿a qué usuarios con
-- avisos de zona se les avisaría, y por qué a los demás no?". No escribe nada,
-- no genera ni encola notificaciones, no marca nada como procesado. Es
-- STABLE: Postgres impide que modifique datos.
--
-- QUÉ NO HACE: no crea crons, ni triggers, ni tablas, ni generar_aviso_zona, ni
-- toca generar_notificacion, favoritos, reservas, cancelaciones o recordatorios.
-- Las únicas tablas que LEE son: clases, avisos_zona, config_avisos_zona,
-- avisos_zona_inmediatos, bloqueos, favoritos y preferencias_notificaciones.
--
-- REGLAS (en este orden; el primer motivo que se cumple es el resultado):
--  Sobre la sesión (valen para todos los usuarios):
--    sesion_no_activa   estado distinto de 'activa' (cancelada)
--    ya_empezada        empieza en p_ahora o antes
--    completa           plazas_ocupadas >= plazas_max
--    fuera_de_horizonte empieza MÁS de 168 horas REALES después de su PUBLICACIÓN
--                       (clases.created_at). Se mide desde la publicación, no
--                       desde la evaluación: una sesión publicada con más de 168 h
--                       de antelación no genera aviso aunque más tarde "entre" en
--                       el plazo (sin avisos retroactivos).
--    sin_coordenadas    la sesión no tiene lat/lng
--  Sobre cada usuario con avisos activados (avisos_zona.activo):
--    sesion_propia                el usuario es el organizador
--    bloqueado                    hay un bloqueo entre ambos, en cualquier sentido
--    publicada_antes_de_activar   la sesión se publicó antes de activar los avisos
--                                 o de cambiar de modalidad (activo_desde)
--    categoria                    su categoría no está entre las elegidas
--    franja                       su hora de inicio queda fuera de la franja
--    fuera_de_radio               a más km (en línea recta) que su radio
--    ya_avisado_por_favoritos     el organizador está en sus favoritos Y tiene
--                                 activa la preferencia "publicaciones": el
--                                 trigger de favoritos YA le avisa de esta sesión
--    ya_avisado_organizador_hoy   (solo modo inmediato) ya recibió un aviso de ese
--                                 organizador el día de publicación (Madrid)
--    tope_diario                  (solo modo inmediato) ya alcanzó el tope de
--                                 avisos inmediatos de ese día
--    recibe                       se le avisaría
--
-- DEVUELVE una fila por usuario: usuario_id, modo, distancia_km, resultado y
-- habilitado (si el interruptor global permitiría hoy avisarle; el resultado
-- "recibe" dice quién recibiría cuando se active, aunque hoy esté apagado).
--   p_detalle = false (por defecto): SOLO los usuarios con resultado 'recibe'
--                      (con prefiltro por caja geográfica para ser eficiente).
--   p_detalle = true : TODOS los usuarios con avisos activados y su motivo
--                      (para diagnóstico y pruebas).
--
-- p_ahora: momento de la evaluación (por defecto now()). Solo decide si la sesión
-- ya ha empezado; el plazo de 168 h cuelga de la publicación.
--
-- Permisos: solo la clave de servicio (y el dueño). Ni anon ni authenticated.
-- Para deshacerlo: sql/080_avisos_zona_evaluacion_reversion.sql.
-- Comprobación posterior: sql/080_avisos_zona_evaluacion_verificacion.sql.
-- ============================================================================

begin;

create or replace function public.avisos_zona_evaluar(
  p_clase_id uuid,
  p_ahora    timestamptz default now(),
  p_detalle  boolean default false
)
returns table (
  usuario_id   uuid,
  modo         text,
  distancia_km double precision,
  resultado    text,
  habilitado   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select cl.id,
           cl.trainer_id,
           cl.categoria,
           cl.hora,
           cl.lat,
           cl.lng,
           cl.created_at,
           public.avisos_zona_dia_madrid(cl.created_at) as dia_publicacion,
           case
             when cl.estado <> 'activa'
               then 'sesion_no_activa'
             when public.avisos_zona_inicio_sesion(cl.fecha, cl.hora) <= p_ahora
               then 'ya_empezada'
             when cl.plazas_ocupadas >= cl.plazas_max
               then 'completa'
             when public.avisos_zona_inicio_sesion(cl.fecha, cl.hora) > cl.created_at + interval '168 hours'
               then 'fuera_de_horizonte'
             when cl.lat is null or cl.lng is null
               then 'sin_coordenadas'
           end as motivo_sesion
      from public.clases cl
     where cl.id = p_clase_id
  ),
  evaluados as (
    select a.usuario_id as uid,
           a.modo       as modo_aviso,
           case when c.lat is not null
             then public.avisos_zona_distancia_km(a.zona_lat, a.zona_lng, c.lat, c.lng)
           end as dist,
           case
             when c.motivo_sesion is not null
               then c.motivo_sesion
             when a.usuario_id = c.trainer_id
               then 'sesion_propia'
             when exists (
                    select 1 from public.bloqueos b
                     where (b.bloqueador_id = a.usuario_id and b.bloqueado_id = c.trainer_id)
                        or (b.bloqueador_id = c.trainer_id and b.bloqueado_id = a.usuario_id))
               then 'bloqueado'
             when c.created_at < a.activo_desde
               then 'publicada_antes_de_activar'
             when not (c.categoria = any (a.categorias))
               then 'categoria'
             when not public.avisos_zona_en_franja(c.hora, a.hora_desde, a.hora_hasta)
               then 'franja'
             when public.avisos_zona_distancia_km(a.zona_lat, a.zona_lng, c.lat, c.lng) > a.radio_km
               then 'fuera_de_radio'
             -- Misma condición que notificar_publicacion_clase() (sql/078): favorito
             -- y preferencia "publicaciones" no desactivada (sin fila = activa).
             when exists (
                    select 1 from public.favoritos f
                     where f.usuario_id = a.usuario_id
                       and f.favorito_id = c.trainer_id
                       and coalesce((select pn.activo
                                       from public.preferencias_notificaciones pn
                                      where pn.usuario_id = f.usuario_id
                                        and pn.categoria = 'publicaciones'), true))
               then 'ya_avisado_por_favoritos'
             when a.modo = 'inmediato'
              and exists (
                    select 1 from public.avisos_zona_inmediatos i
                     where i.usuario_id = a.usuario_id
                       and i.organizador_id = c.trainer_id
                       and i.dia = c.dia_publicacion)
               then 'ya_avisado_organizador_hoy'
             when a.modo = 'inmediato'
              and (select count(*) from public.avisos_zona_inmediatos i
                    where i.usuario_id = a.usuario_id
                      and i.dia = c.dia_publicacion)
                  >= (select cfg.tope_inmediatos_usuario_dia
                        from public.config_avisos_zona cfg where cfg.id)
               then 'tope_diario'
             else 'recibe'
           end as res
      from public.avisos_zona a
     cross join c
     where a.activo
       -- Prefiltro (solo sin detalle): sesión evaluable y dentro de la caja
       -- geográfica del radio del usuario. 110 km por grado es algo MENOS que el
       -- valor real (111,19), así que la caja nunca descarta a nadie que esté
       -- dentro de su radio; la distancia exacta decide después.
       and (p_detalle
            or (c.motivo_sesion is null
                and a.zona_lat between c.lat - a.radio_km / 110.0
                                   and c.lat + a.radio_km / 110.0
                and a.zona_lng between c.lng - a.radio_km / (110.0 * greatest(cos(radians(c.lat)), 0.01))
                                   and c.lng + a.radio_km / (110.0 * greatest(cos(radians(c.lat)), 0.01))))
  )
  select e.uid,
         e.modo_aviso,
         e.dist,
         e.res,
         public.avisos_zona_habilitado(
           e.uid,
           case e.modo_aviso when 'inmediato' then 'inmediato' else 'resumen' end
         )
    from evaluados e
   where p_detalle or e.res = 'recibe'
$$;

comment on function public.avisos_zona_evaluar(uuid, timestamptz, boolean) is
  'Evaluación EN SECO de Avisos de sesiones en mi zona: devuelve a qué usuarios se avisaría por una sesión (resultado = recibe) y, con p_detalle, el motivo de exclusión de los demás. Solo lectura: no genera ni encola notificaciones.';

-- Solo la clave de servicio (y el dueño). Ni público, ni anon, ni authenticated.
revoke all on function public.avisos_zona_evaluar(uuid, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.avisos_zona_evaluar(uuid, timestamptz, boolean)
  to service_role;

commit;
