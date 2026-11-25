-- ============================================================================
-- Ruleafit · 094_ubicacion_editable.sql
-- Permite cambiar la UBICACIÓN de sesiones ya publicadas (coordenadas, municipio, provincia y zona) protegiendo a quien
-- ya ha reservado.
--
-- REGLAS (todas en el servidor, dentro de la propia operación de guardado):
--  · Una sesión con reservas ACTIVAS nunca cambia de ubicación (ni coordenadas, ni municipio, ni provincia, ni zona).
--  · Se respeta el alcance actual de editar_serie (solo_esta / esta_y_siguientes / toda_futura): nunca se tocan sesiones
--    fuera de él.
--  · En un alcance de serie, las sesiones con reservas se EXCLUYEN y conservan sus datos; si hay exclusión, el cambio
--    parcial exige confirmación expresa (campo confirmar_parcial) o no se hace nada.
--  · Para una sola sesión con reservas se rechaza con un mensaje claro y no se modifica nada (ni lo demás: todo o nada).
--  · CONCURRENCIA: antes de contar reservas se bloquean (FOR UPDATE, en orden de id) las filas de las sesiones afectadas.
--    Toda forma de crear una reserva (reservar_clase, confirmar_cobro_pagado) bloquea antes la fila de la sesión, así que
--    una reserva no puede colarse entre la comprobación y el guardado: espera a que termine la edición y se hará sobre la
--    ubicación ya nueva. Si la reserva llegó antes, la edición la ve y excluye/rechaza la sesión.
--  · Coherencia: lat, lng, municipio, provincia y zona se guardan juntos en la misma sentencia; no se admite una
--    ubicación sin coordenadas o sin municipio.
--
-- QUÉ CAMBIA
--  1) editar_serie(uuid, text, jsonb): MISMA firma y mismo comportamiento previo; solo añade la clave opcional
--     «ubicacion» (y «confirmar_parcial») en p_campos. Sin «ubicacion», el resultado es idéntico al anterior.
--  2) previsualizar_ubicacion_serie(uuid, text): NUEVA, solo lectura: cuántas sesiones del alcance se podrían actualizar
--     y cuántas tienen reservas (para informar antes de confirmar).
--  No toca reservas, cancelaciones, bonos ni pagos. editar_clase no cambia.
--
-- Reversión: sql/094_ubicacion_editable_reversion.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Previsualización (solo lectura): ¿qué pasaría si cambio la ubicación en este alcance?
-- ---------------------------------------------------------------------------
create or replace function public.previsualizar_ubicacion_serie(p_clase_id uuid, p_alcance text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_con   integer;
  v_fuera integer;
  v_lista jsonb;
  v_ahora timestamp := (now() at time zone 'Europe/Madrid');
begin
  -- serie_sesiones_objetivo valida la sesión, la titularidad y el alcance (lanza error si no procede).
  select count(*),
         count(*) filter (where exists (select 1 from public.reservas r where r.clase_id = c.id and r.estado = 'activa')),
         count(*) filter (where (c.fecha::text || ' ' || c.hora::text)::timestamp - v_ahora < interval '2 hours')
    into v_total, v_con, v_fuera
    from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
    join public.clases c on c.id = o.id;

  select coalesce(jsonb_agg(jsonb_build_object('clase_id', c.id, 'fecha', c.fecha, 'hora', c.hora) order by c.fecha, c.hora), '[]'::jsonb)
    into v_lista
    from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
    join public.clases c on c.id = o.id
   where exists (select 1 from public.reservas r where r.clase_id = c.id and r.estado = 'activa');

  return jsonb_build_object(
    'total', v_total,
    'con_reservas', v_con,
    'sin_reservas', v_total - v_con,
    'fuera_de_plazo', v_fuera,
    'sesiones_con_reservas', v_lista
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- editar_serie: igual que antes + cambio de ubicación protegido
-- ---------------------------------------------------------------------------
create or replace function public.editar_serie(p_clase_id uuid, p_alcance text, p_campos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_c         record;
  v_editadas  integer := 0;
  v_cond_ok   integer := 0;
  v_cond_omit integer := 0;
  v_omitidas  jsonb := '[]'::jsonb;
  v_hay_cond  boolean;
  v_precio    numeric;
  v_dur       integer;
  v_con_res   boolean;
  -- ubicación (C: ubicación editable)
  v_hay_ubic  boolean;
  v_u         jsonb;
  v_ulat      double precision;
  v_ulng      double precision;
  v_uciudad   text;
  v_uprov     text;
  v_udir      text;
  v_utotal    integer;
  v_ucon      integer;
  v_ubic_ok   integer := 0;
  v_ubic_omit integer := 0;
  v_con_res2  boolean;
begin
  perform pg_advisory_xact_lock(hashtext('serie_op:' || coalesce(auth.uid()::text, '')));

  v_hay_cond := (p_campos ? 'precio') or (p_campos ? 'duracion');
  if p_campos ? 'precio' then
    v_precio := nullif(p_campos->>'precio', '')::numeric;
    if v_precio is null or v_precio < 0 or v_precio <> round(v_precio, 2) then
      raise exception 'El precio debe ser un importe válido con un máximo de 2 decimales.' using errcode = 'P0001';
    end if;
  end if;
  if p_campos ? 'duracion' then
    v_dur := nullif(p_campos->>'duracion', '')::integer;
    if v_dur is null or v_dur < 1 then
      raise exception 'La duración debe ser un número de minutos mayor que 0.' using errcode = 'P0001';
    end if;
    if exists (
         select 1
           from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
           join public.clases a on a.id = o.id
           join public.clases b on b.serie_id = a.serie_id and b.fecha = a.fecha and b.estado = 'activa' and b.hora > a.hora
          where a.hora + make_interval(mins => v_dur) > b.hora) then
      raise exception 'Con esa duración se solaparían sesiones de la serie el mismo día.' using errcode = 'P0001';
    end if;
  end if;

  -- ---- Ubicación: validación, bloqueo de las sesiones afectadas y decisión previa (todo o nada) ----
  v_hay_ubic := p_campos ? 'ubicacion';
  if v_hay_ubic then
    v_u := p_campos -> 'ubicacion';
    if jsonb_typeof(v_u) is distinct from 'object'
       or jsonb_typeof(v_u -> 'lat') is distinct from 'number'
       or jsonb_typeof(v_u -> 'lng') is distinct from 'number' then
      raise exception 'La ubicación debe incluir las coordenadas del mapa.' using errcode = 'P0001';
    end if;
    v_ulat := (v_u ->> 'lat')::double precision;
    v_ulng := (v_u ->> 'lng')::double precision;
    -- España (península, Baleares, Canarias, Ceuta y Melilla): descarta valores absurdos.
    if v_ulat < 27 or v_ulat > 44.5 or v_ulng < -19 or v_ulng > 5.5 then
      raise exception 'La ubicación debe estar en España.' using errcode = 'P0001';
    end if;
    v_uciudad := nullif(btrim(coalesce(v_u ->> 'ciudad', '')), '');
    if v_uciudad is null then
      raise exception 'Falta el municipio de la ubicación.' using errcode = 'P0001';
    end if;
    v_uprov := nullif(btrim(coalesce(v_u ->> 'provincia', '')), '');
    v_udir := nullif(btrim(coalesce(v_u ->> 'direccion', '')), '');
    if char_length(v_uciudad) > 100 or char_length(coalesce(v_uprov, '')) > 100 or char_length(coalesce(v_udir, '')) > 300 then
      raise exception 'La ubicación tiene datos demasiado largos.' using errcode = 'P0001';
    end if;

    -- Bloquea las filas de TODAS las sesiones afectadas (orden de id: sin interbloqueos entre ediciones). Las reservas
    -- bloquean la misma fila antes de crearse: ninguna puede colarse entre este recuento y el guardado.
    perform 1 from public.clases c
      where c.id in (select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o)
      order by c.id for update;

    select count(*),
           count(*) filter (where exists (select 1 from public.reservas r where r.clase_id = c.id and r.estado = 'activa'))
      into v_utotal, v_ucon
      from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
      join public.clases c on c.id = o.id;

    if v_ucon > 0 then
      if v_utotal = 1 then
        raise exception 'Esta sesión ya tiene reservas. No puedes cambiar su ubicación para evitar confusiones entre los participantes.' using errcode = 'P0001';
      elsif v_ucon = v_utotal then
        raise exception 'Todas las sesiones seleccionadas ya tienen reservas. No puedes cambiar su ubicación para evitar confusiones entre los participantes.' using errcode = 'P0001';
      elsif coalesce((p_campos ->> 'confirmar_parcial')::boolean, false) is not true then
        raise exception 'Hay sesiones con reservas que conservarían su ubicación. Confirma la modificación parcial para continuar.' using errcode = 'P0001';
      end if;
    end if;
  end if;

  for v_id in
    select o.id from public.serie_sesiones_objetivo(p_clase_id, p_alcance) o
      join public.clases c on c.id = o.id order by c.fecha, c.hora
  loop
    select c.* into v_c from public.clases c where c.id = v_id;

    begin
      perform public.editar_clase(
        v_id,
        coalesce(nullif(btrim(p_campos->>'titulo'), ''), v_c.titulo),
        coalesce(p_campos->>'tipo_actividad', v_c.tipo_actividad),
        coalesce(p_campos->>'categoria', v_c.categoria),
        coalesce(p_campos->>'nivel', v_c.nivel),
        case when p_campos ? 'material' then p_campos->>'material' else v_c.material end,
        case when p_campos ? 'observaciones' then p_campos->>'observaciones' else v_c.observaciones end,
        case when p_campos ? 'punto_encuentro' then p_campos->>'punto_encuentro' else v_c.punto_encuentro end,
        coalesce(nullif(p_campos->>'plazas_min', '')::integer, v_c.plazas_min),
        coalesce(nullif(p_campos->>'plazas_max', '')::integer, v_c.plazas_max)
      );
      v_editadas := v_editadas + 1;
    exception when others then
      v_omitidas := v_omitidas || jsonb_build_array(jsonb_build_object(
        'clase_id', v_id, 'fecha', v_c.fecha, 'hora', v_c.hora, 'motivo', sqlerrm));
      continue;
    end;

    if v_hay_cond then
      select exists (select 1 from public.reservas r where r.clase_id = v_id and r.estado = 'activa') into v_con_res;
      if v_con_res then
        v_cond_omit := v_cond_omit + 1;
        v_omitidas := v_omitidas || jsonb_build_array(jsonb_build_object(
          'clase_id', v_id, 'fecha', v_c.fecha, 'hora', v_c.hora,
          'motivo', 'Tiene reservas: el precio y la duración no se han modificado.'));
      else
        update public.clases
           set precio = coalesce(v_precio, precio),
               duracion = coalesce(v_dur, duracion)
         where id = v_id;
        v_cond_ok := v_cond_ok + 1;
      end if;
    end if;

    -- Ubicación: solo si la sesión NO tiene reservas activas (fila ya bloqueada arriba: no puede aparecer una ahora).
    if v_hay_ubic then
      select exists (select 1 from public.reservas r where r.clase_id = v_id and r.estado = 'activa') into v_con_res2;
      if v_con_res2 then
        v_ubic_omit := v_ubic_omit + 1;
        v_omitidas := v_omitidas || jsonb_build_array(jsonb_build_object(
          'clase_id', v_id, 'fecha', v_c.fecha, 'hora', v_c.hora,
          'motivo', 'Tiene reservas: su ubicación no se ha modificado.'));
      else
        update public.clases
           set lat = v_ulat, lng = v_ulng, ciudad = v_uciudad, provincia = v_uprov, direccion = v_udir
         where id = v_id;
        v_ubic_ok := v_ubic_ok + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'editadas', v_editadas, 'omitidas', v_omitidas,
                            'condiciones_aplicadas', v_cond_ok, 'condiciones_omitidas', v_cond_omit,
                            'ubicacion_aplicadas', v_ubic_ok, 'ubicacion_omitidas', v_ubic_omit);
end;
$$;

revoke all on function public.previsualizar_ubicacion_serie(uuid, text) from public, anon;
grant execute on function public.previsualizar_ubicacion_serie(uuid, text) to authenticated;
