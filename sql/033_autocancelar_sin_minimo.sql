-- ============================================================================
-- Ruleafit · 033_autocancelar_sin_minimo.sql
-- Cancelación automática de clases que no van a alcanzar su plazas_min a
-- tiempo: función pensada para ser invocada periódicamente por un cron (cada
-- 5 minutos), que cancela toda clase activa con mínimo definido cuya
-- ocupación siga por debajo del mínimo cuando entra en la ventana de 1h50
-- antes de su inicio.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tablas public.clases / public.reservas,
-- criterio de fecha+hora exacta en Europe/Madrid), sql/007_minimo_y_cancelar_clase.sql
-- (columna plazas_min) y sql/031_motivo_cancelacion.sql (columna
-- motivo_cancelacion en public.clases). Sigue el mismo patrón de
-- cancelar_clase() (sql/008_aviso_cancelacion_entrenador.sql): bloqueo de
-- fila con FOR UPDATE y actualización en bloque de las reservas activas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función autocancelar_clases_sin_minimo()
--    Sin parámetros: no la llama un usuario concreto, la llama el sistema
--    (cron), así que no hay auth.uid() que comprobar ni propiedad que
--    validar, a diferencia de cancelar_clase().
--    Recorre con FOR ... LOOP las clases candidatas (SELECT ... FOR UPDATE,
--    bloquea cada fila igual que reservar_clase/cancelar_clase) y, por cada
--    una, cancela la clase y sus reservas activas dentro de la misma
--    transacción de la función: si algo fallara a mitad, Postgres deshace
--    todo lo hecho hasta ese punto.
-- ----------------------------------------------------------------------------
create or replace function public.autocancelar_clases_sin_minimo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora_local        timestamp;
  v_clase              record;
  v_clases_canceladas  integer := 0;
begin
  -- 1. Hora actual en zona horaria de España, mismo criterio que
  --    reservar_clase/cancelar_reserva/cancelar_clase.
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  -- 2. Clases candidatas: activas, con mínimo definido, por debajo del
  --    mínimo, que todavía no han empezado y que ya están dentro de la
  --    ventana de 1h50 antes de su inicio. FOR UPDATE bloquea cada fila
  --    hasta que termine esta transacción, igual que en cancelar_clase().
  for v_clase in
    select id, fecha, hora
      from public.clases
      where estado = 'activa'
        and plazas_min > 0
        and plazas_ocupadas < plazas_min
        and (fecha::text || ' ' || hora::text)::timestamp > v_ahora_local
        and (fecha::text || ' ' || hora::text)::timestamp <= v_ahora_local + interval '1 hour 50 minutes'
      for update
  loop
    -- 3a. Marcar la clase como cancelada, con motivo 'minimo'.
    update public.clases
      set estado = 'cancelada',
          motivo_cancelacion = 'minimo'
      where id = v_clase.id;

    -- 3b. Cancelar de golpe todas las reservas activas de esta clase.
    --     cancelada_por_entrenador se deja en su valor por defecto (false):
    --     esta cancelación no la decide el entrenador, la dispara el
    --     sistema por no alcanzar el mínimo.
    update public.reservas
      set estado = 'cancelada',
          cancelled_at = now()
      where clase_id = v_clase.id
        and estado = 'activa';

    -- 3c. Contar esta clase como cancelada en esta ejecución.
    v_clases_canceladas := v_clases_canceladas + 1;
  end loop;

  -- 4. Devolver cuántas clases se cancelaron en esta ejecución.
  return v_clases_canceladas;
end;
$$;

comment on function public.autocancelar_clases_sin_minimo() is
  'Pensada para ser ejecutada por un cron cada 5 minutos: cancela automáticamente las clases activas con plazas_min > 0 que sigan sin alcanzar el mínimo cuando entran en la ventana de 1h50 antes de su inicio (misma lógica de cancelación en bloque que cancelar_clase, marcando motivo_cancelacion = ''minimo'' y sin tocar cancelada_por_entrenador). No valida propiedad ni auth.uid(): la invoca el sistema, no un usuario concreto. Devuelve el número de clases canceladas en la ejecución.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: ninguno para roles de cliente.
--    A diferencia de las funciones que llama el usuario final (reservar_clase,
--    cancelar_reserva, cancelar_clase...), esta no se concede a authenticated:
--    solo debe poder ejecutarla el propio sistema (cron/postgres), nunca
--    desde el cliente.
-- ----------------------------------------------------------------------------
revoke all on function public.autocancelar_clases_sin_minimo() from public;
