-- ============================================================================
-- Ruleafit · 057_asistencia_automatica.sql
-- Elimina el marcado manual de asistencia por el entrenador y lo sustituye
-- por concesión automática de Rulos cuando la clase se completa: un cron
-- recorre las reservas activas de clases ya pasadas y concede los mismos 5
-- Rulos que antes concedía marcar_asistencia() al marcar 'asistio'.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "ruleafit").
--
-- IMPORTANTE sobre nombres: el rename de sistema de puntos Open -> Rulos se
-- hizo a mano en Supabase y no está versionado en sql/ (los archivos 006 y
-- 026 todavía dicen "otorgar_open"/"open_saldos"). En la base de datos real
-- las tablas y funciones ya se llaman rulos_saldos / rulos_movimientos /
-- rulos_motivos / otorgar_rulos() (ver PROGRESS.md, sección "Rename sistema
-- de puntos Open -> Rulos"). Este archivo usa esos nombres reales.
--
-- Depende de sql/001_reservas.sql (tabla public.reservas, columna estado),
-- sql/006_open_fidelización.sql (columna reservas.asistencia, ya congelada
-- sin uso a partir de aquí; función de concesión, ahora otorgar_rulos()) y
-- sql/025_tabla_valoraciones.sql (políticas RLS que este archivo sustituye
-- en el punto 4). Sigue el mismo patrón de función de mantenimiento por cron
-- que autocancelar_clases_sin_minimo() (sql/033) y el mismo criterio de
-- fecha+hora exacta en Europe/Madrid que marcar_asistencia() / cancelar_reserva()
-- / autocancelar_clases_sin_minimo().
--
-- No se borran las columnas reservas.asistencia / asistencia_marcada_en /
-- asistencia_marcada_por: quedan como histórico sin uso (decisión de
-- producto). No se toca reservas_de_mis_clases(): sigue devolviendo la
-- columna asistencia, simplemente el frontend deja de leerla.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Función completar_asistencia_clases_pasadas()
--    Sin parámetros: no la llama un usuario concreto, la llama el sistema
--    (cron), mismo patrón que autocancelar_clases_sin_minimo() (sql/033):
--    sin auth.uid() que comprobar ni propiedad que validar.
--
--    Guarda contra doble concesión: en vez de inventar un mecanismo nuevo,
--    reutiliza el mismo patrón de referencia_tipo/referencia_id que ya usaba
--    marcar_asistencia() al llamar a otorgar_rulos() (referencia_tipo =
--    'reserva', referencia_id = id de la reserva) — se concede Rulos solo si
--    todavía no existe un movimiento con esa referencia y motivo
--    'asistencia_confirmada'. Como marcar_asistencia() usaba exactamente la
--    misma referencia, esto también evita doble concesión sobre reservas que
--    ya hubieran recibido sus Rulos por el camino manual antes de este cambio.
--
--    Ventana de 72h hacia atrás: autocancelar_clases_sin_minimo() acota hacia
--    adelante (1h50 antes del inicio), no hay un patrón de ventana hacia
--    atrás que copiar; se usa un rango razonable de 72h para no recorrer toda
--    la tabla histórica de reservas en cada ejecución (con el cron cada 15
--    minutos, 72h da margen de sobra ante cualquier caída temporal del cron).
--
--    No hace falta bloquear filas con FOR UPDATE: esta función no escribe en
--    reservas (a diferencia de autocancelar_clases_sin_minimo, que sí
--    modifica clases/reservas), solo lee reservas/clases y llama a
--    otorgar_rulos(), que ya inserta su propio movimiento de forma atómica.
-- ----------------------------------------------------------------------------
create or replace function public.completar_asistencia_clases_pasadas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora_local      timestamp;
  v_reserva          record;
  v_rulos_concedidos integer := 0;
  v_cantidad_rulos   constant integer := 5;
begin
  -- 1. Hora actual en zona horaria de España, mismo criterio que
  --    marcar_asistencia/cancelar_reserva/autocancelar_clases_sin_minimo.
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  -- 2. Reservas candidatas: activas, de clases cuyo inicio ya ha pasado
  --    (mismo umbral que usaba marcar_asistencia para permitir marcar
  --    asistencia: v_clase_inicio <= v_ahora_local), acotadas a clases que
  --    empezaron en las últimas 72h, y que todavía no tienen su movimiento
  --    de Rulos de asistencia concedido.
  for v_reserva in
    select r.id, r.cliente_id
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora_local
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora_local - interval '72 hours'
        and not exists (
          select 1
            from public.rulos_movimientos m
            where m.referencia_tipo = 'reserva'
              and m.referencia_id = r.id
              and m.motivo = 'asistencia_confirmada'
        )
  loop
    perform public.otorgar_rulos(
      p_usuario_id      => v_reserva.cliente_id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'asistencia_confirmada',
      p_referencia_tipo => 'reserva',
      p_referencia_id   => v_reserva.id,
      p_otorgado_por    => null,
      p_nota            => null
    );

    v_rulos_concedidos := v_rulos_concedidos + 1;
  end loop;

  -- 3. Devolver cuántas reservas recibieron Rulos en esta ejecución.
  return v_rulos_concedidos;
end;
$$;

comment on function public.completar_asistencia_clases_pasadas() is
  'Pensada para ser ejecutada por un cron cada 15 minutos: concede automáticamente 5 Rulos (motivo asistencia_confirmada) a cada reserva activa cuya clase ya haya empezado (mismo criterio Europe/Madrid que marcar_asistencia), acotado a clases de las últimas 72h. Evita doble concesión comprobando que no exista ya un movimiento en rulos_movimientos con referencia_tipo=''reserva'' y referencia_id = la reserva, mismo patrón de referencia que usaba marcar_asistencia() al llamar a otorgar_rulos(). No valida propiedad ni auth.uid(): la invoca el sistema, no un usuario concreto. Devuelve el número de reservas que recibieron Rulos en la ejecución.';


-- ----------------------------------------------------------------------------
-- 2) Permisos de ejecución: ninguno para roles de cliente.
--    Igual que autocancelar_clases_sin_minimo(), solo debe poder ejecutarla
--    el propio sistema (cron/postgres), nunca desde el cliente.
-- ----------------------------------------------------------------------------
revoke all on function public.completar_asistencia_clases_pasadas() from public;


-- ----------------------------------------------------------------------------
-- 3) Cron: ejecuta completar_asistencia_clases_pasadas() cada 15 minutos.
--    cron.schedule con el mismo nombre re-ejecuta de forma idempotente
--    (actualiza el job), mismo patrón que sql/034 y sql/043.
-- ----------------------------------------------------------------------------
select cron.schedule(
  'completar-asistencia-clases-pasadas',
  '*/15 * * * *',
  $$ select completar_asistencia_clases_pasadas(); $$
);


-- ----------------------------------------------------------------------------
-- 4) Retirar marcar_asistencia() del cliente: se deja de poder llamar desde
--    el frontend (revoke execute a authenticated), pero no se borra la
--    función ni su definición en sql/006, por si hiciera falta consultarla o
--    revertir en el futuro.
-- ----------------------------------------------------------------------------
revoke execute on function public.marcar_asistencia(uuid, boolean) from authenticated;


-- ----------------------------------------------------------------------------
-- 5) Políticas RLS de public.valoraciones (sql/025): dejan de exigir
--    r.asistencia = 'asistio' (columna congelada, ya no se actualiza) y pasan
--    a exigir reserva activa de una clase ya pasada, mismo criterio
--    Europe/Madrid que el resto de esta función. Mismo nombre de política
--    (DROP + CREATE) para sustituir la condición sin tocar la lectura pública
--    ni la ausencia de política de DELETE.
-- ----------------------------------------------------------------------------
drop policy if exists "cliente inserta valoracion si asistio" on public.valoraciones;

create policy "cliente inserta valoracion si asistio"
  on public.valoraciones
  for insert
  to authenticated
  with check (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= (now() at time zone 'Europe/Madrid')
    )
  );

drop policy if exists "cliente edita su propia valoracion si asistio" on public.valoraciones;

create policy "cliente edita su propia valoracion si asistio"
  on public.valoraciones
  for update
  to authenticated
  using (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= (now() at time zone 'Europe/Madrid')
    )
  )
  with check (
    auth.uid() = cliente_id
    and exists (
      select 1
      from public.reservas r
      join public.clases c on c.id = r.clase_id
      where r.cliente_id = auth.uid()
        and c.trainer_id = valoraciones.entrenador_id
        and r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= (now() at time zone 'Europe/Madrid')
    )
  );
