-- ============================================================================
-- Ruleafit · 066_valorar_tras_cancelacion_tardia_entrenador.sql
-- Amplía las políticas RLS de public.valoraciones para permitir valorar a un
-- entrenador también cuando este cancela la clase entera (cancelar_clase())
-- con menos de 2 horas de antelación respecto al inicio, aunque la clase
-- nunca haya llegado a celebrarse. Pedido explícito del usuario el 2 de
-- octubre de 2026.
--
-- No cubre la autocancelación por no alcanzar el mínimo de plazas
-- (autocancelar_clases_sin_minimo()): esa función nunca pone
-- reservas.cancelada_por_entrenador = true (solo cancelar_clase() lo hace),
-- así que esas reservas quedan excluidas de forma natural por la condición
-- nueva, sin tener que mirar clases.motivo_cancelacion.
--
-- Depende de columnas ya existentes en producción, confirmadas a mano en el
-- SQL Editor de Supabase el 2 de octubre de 2026 (no versionadas en este
-- repo local, que solo tiene 004 y 065):
--   - reservas.cancelled_at (timestamptz) y reservas.cancelada_por_entrenador
--     (boolean), ambas rellenadas por cancelar_clase().
--   - Las dos políticas de valoraciones creadas en
--     sql/057_asistencia_automatica.sql ("cliente inserta valoracion si
--     asistio" e "cliente edita su propia valoracion si asistio"), cuyo
--     texto exacto se leyó directamente de Supabase para escribir este
--     archivo sin adivinar nada.
--
-- Condición añadida a INSERT y UPDATE de valoraciones (con OR respecto a la
-- condición ya existente de "reserva activa + clase ya pasada"): existe una
-- reserva de este cliente en una clase de este entrenador que el entrenador
-- canceló a mano, y esa cancelación ocurrió menos de 2 horas antes de la
-- hora de inicio de la clase.
--
-- alter policy no admite "if exists", así que si algún nombre de política
-- cambió entre que se leyó y que se ejecuta esto, dará error claro en vez
-- de fallar en silencio.
-- ============================================================================

alter policy "cliente inserta valoracion si asistio"
on public.valoraciones
with check (
  (auth.uid() = cliente_id) and (
    exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            <= (now() at time zone 'Europe/Madrid')
    )
    or exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.cancelada_por_entrenador = true
        and r.cancelled_at is not null
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            - (r.cancelled_at at time zone 'Europe/Madrid') < interval '2 hours'
    )
  )
);

alter policy "cliente edita su propia valoracion si asistio"
on public.valoraciones
using (
  (auth.uid() = cliente_id) and (
    exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            <= (now() at time zone 'Europe/Madrid')
    )
    or exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.cancelada_por_entrenador = true
        and r.cancelled_at is not null
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            - (r.cancelled_at at time zone 'Europe/Madrid') < interval '2 hours'
    )
  )
)
with check (
  (auth.uid() = cliente_id) and (
    exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            <= (now() at time zone 'Europe/Madrid')
    )
    or exists (
      select 1
      from reservas r
      join clases c on (c.id = r.clase_id)
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.cancelada_por_entrenador = true
        and r.cancelled_at is not null
        and (((c.fecha)::text || ' ' || (c.hora)::text)::timestamp without time zone)
            - (r.cancelled_at at time zone 'Europe/Madrid') < interval '2 hours'
    )
  )
);
