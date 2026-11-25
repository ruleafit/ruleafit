-- ============================================================================
-- Ruleafit · 094_ubicacion_editable_reversion.sql
-- Restaura editar_serie EXACTAMENTE como estaba antes (sin cambio de ubicación) y elimina previsualizar_ubicacion_serie.
-- No modifica ninguna sesión: las ubicaciones ya cambiadas se quedan como están.
-- ============================================================================
drop function if exists public.previsualizar_ubicacion_serie(uuid, text);

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
  end loop;

  return jsonb_build_object('ok', true, 'editadas', v_editadas, 'omitidas', v_omitidas,
                            'condiciones_aplicadas', v_cond_ok, 'condiciones_omitidas', v_cond_omit);
end;
$$;
