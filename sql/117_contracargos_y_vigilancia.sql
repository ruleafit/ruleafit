-- ============================================================================
-- Ruleafit · 117_contracargos_y_vigilancia.sql
-- Paso 7: contracargos (el banco retira un pago porque el titular de la tarjeta lo reclama) y vigilancia.
-- Requiere sql/071-116. No activa pagos y no habla con el banco: el administrador anota lo que el banco comunica.
--
--  · Abierto: el importe queda retenido (ni se libera, ni se liquida, ni se pide otra devolución).
--  · Ganado o anulado: se quita la retención; no se mueve dinero.
--  · Perdido: se descuenta de la bolsa del organizador lo que aún tuviera de ese cobro (puede quedar en negativo y se
--    compensa después). Ruleafit pierde su comisión. Si es por el total, se cancela la reserva futura o el bono.
--  · revisar_vigilancia(): plazos de contracargos, transferencias sin enviar, saldos negativos y «latido» del cron.
--
-- Redefine cobro_retenido (108), liquidacion_cobros (114) y reclamar_devolucion_cobro (096/107): no reejecutar esos
-- archivos sin volver a ejecutar este. Se puede ejecutar varias veces. Reversión: 117_..._reversion.sql
-- ============================================================================

alter table public.config_pagos add column if not exists ultima_revision_en timestamptz;

create table if not exists public.contracargos (
  id                  uuid primary key default gen_random_uuid(),
  cobro_id            uuid not null references public.cobros(id) on delete restrict,
  importe_centimos    integer not null check (importe_centimos > 0),
  estado              text not null default 'abierto' check (estado in ('abierto', 'ganado', 'perdido', 'anulado')),
  referencia_banco    text,
  motivo              text,
  fecha_limite        date,
  descontado_centimos integer check (descontado_centimos >= 0),
  creado_en           timestamptz not null default now(),
  resuelto_en         timestamptz
);
create unique index if not exists contracargos_abierto_unico on public.contracargos (cobro_id) where estado = 'abierto';
alter table public.contracargos enable row level security;
revoke all on public.contracargos from anon, authenticated;
grant select, insert, update on public.contracargos to service_role;

create or replace function public.registrar_contracargo(
  p_pedido text, p_importe_centimos integer default null, p_referencia text default null,
  p_motivo text default null, p_fecha_limite date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c       public.cobros%rowtype;
  v_vivo    integer;
  v_importe integer;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  select * into v_c from public.cobros where pedido_redsys = btrim(coalesce(p_pedido, '')) for update;
  if not found then
    raise exception 'No hay ningún cobro con ese número de pedido.' using errcode = 'P0002';
  end if;
  if v_c.estado not in ('pagado', 'reembolsado_parcial', 'requiere_reembolso', 'reembolsado') then
    raise exception 'Ese cobro no llegó a pagarse.' using errcode = 'P0001';
  end if;
  -- Lo que el banco todavía puede retirar de este pago.
  v_vivo := v_c.importe_centimos
            - case when v_c.estado = 'reembolsado_parcial' then coalesce(v_c.importe_devolver_centimos, 0) else 0 end;
  v_importe := coalesce(p_importe_centimos, v_vivo);
  if v_importe <= 0 or v_importe > v_c.importe_centimos then
    raise exception 'El importe no es válido para este cobro.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.contracargos where cobro_id = v_c.id and estado = 'abierto') then
    raise exception 'Ese cobro ya tiene un contracargo abierto.' using errcode = 'P0001';
  end if;
  insert into public.contracargos (cobro_id, importe_centimos, referencia_banco, motivo, fecha_limite)
  values (v_c.id, v_importe, nullif(left(btrim(coalesce(p_referencia, '')), 100), ''),
          nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), p_fecha_limite)
  returning id into v_id;
  perform public.registrar_alerta('incidencias', 'contracargo:' || v_id, 'critica',
    format('Contracargo abierto en el pedido %s%s%s (/admin/contracargos).', v_c.pedido_redsys,
      case when v_c.estado = 'reembolsado' then '. OJO: el cobro ya estaba devuelto, el alumno podría cobrar dos veces' else '' end,
      case when exists (select 1 from public.liquidaciones_lineas ll
                         where ll.liquidacion_id = v_c.liquidacion_id and ll.entrenador_id = v_c.entrenador_id and ll.estado = 'pendiente')
           then '. Hay una transferencia sin enviar a ese organizador: valora anularla antes de firmarla' else '' end));
  return jsonb_build_object('ok', true, 'id', v_id, 'estado_cobro', v_c.estado,
    'transferencia_pendiente', exists (select 1 from public.liquidaciones_lineas ll
       where ll.liquidacion_id = v_c.liquidacion_id and ll.entrenador_id = v_c.entrenador_id and ll.estado = 'pendiente'));
end;
$$;

create or replace function public.resolver_contracargo(p_id uuid, p_resultado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_k       public.contracargos%rowtype;
  v_c       public.cobros%rowtype;
  v_vivo    integer;
  v_total   boolean;
  v_queda   bigint;
  v_quitar  integer := 0;
  v_bolsa   text;
  r         record;
begin
  if p_resultado is null or p_resultado not in ('ganado', 'perdido', 'anulado') then
    raise exception 'Resultado no válido.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  select * into v_k from public.contracargos where id = p_id for update;
  if not found then
    raise exception 'El contracargo no existe.' using errcode = 'P0002';
  end if;
  if v_k.estado <> 'abierto' then
    raise exception 'Este contracargo ya está cerrado como %.', v_k.estado using errcode = 'P0001';
  end if;
  select * into v_c from public.cobros where id = v_k.cobro_id for update;

  if p_resultado = 'perdido' then
    v_vivo := v_c.importe_centimos
              - case when v_c.estado = 'reembolsado_parcial' then coalesce(v_c.importe_devolver_centimos, 0) else 0 end;
    v_total := v_k.importe_centimos >= v_vivo;
    if v_c.estado = 'requiere_reembolso' and not v_total then
      raise exception 'Este cobro tiene una devolución pendiente y el contracargo es parcial: resuélvelo con el banco antes.'
        using errcode = 'P0001';
    end if;
    -- Lo que el organizador aún tiene anotado por este cobro (la liberación suma cero).
    select coalesce(sum(importe_centimos), 0) into v_queda from public.movimientos_bolsa where cobro_id = v_c.id;
    v_quitar := greatest(case when v_total then v_queda
      else least(v_queda, round(v_c.neto_centimos::numeric * v_k.importe_centimos / v_c.importe_centimos)) end, 0)::integer;
    if v_quitar > 0 then
      v_bolsa := case when v_c.liberado_en is null then 'pendiente' else 'disponible' end;
      insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
      values (v_c.entrenador_id, v_c.id, 'contracargo', v_bolsa, -v_quitar, 'Contracargo del banco');
      update public.bolsas
         set pendiente_centimos  = pendiente_centimos - case when v_bolsa = 'pendiente' then v_quitar else 0 end,
             disponible_centimos = disponible_centimos - case when v_bolsa = 'disponible' then v_quitar else 0 end
       where entrenador_id = v_c.entrenador_id;
    end if;
    if v_c.estado <> 'reembolsado' then
      if v_total then
        update public.cobros set estado = 'reembolsado', updated_at = now() where id = v_c.id;
        -- El alumno ya tiene el dinero: se anula su bono y se libera su plaza futura.
        if v_c.tipo = 'bono' then
          update public.bonos_clientes set anulado_en = now(), anulado_motivo = 'Contracargo', fecha_fin = now()
           where id = v_c.bono_cliente_id and anulado_en is null;
        end if;
        perform set_config('ruleafit.bono_devolucion', '1', true);
        for r in
          select re.id, re.clase_id
            from public.reservas re join public.clases c on c.id = re.clase_id
           where re.estado = 'activa' and c.estado = 'activa'
             and (c.fecha + c.hora) > (now() at time zone 'Europe/Madrid')
             and (re.id = v_c.reserva_id or (v_c.tipo = 'bono' and re.bono_cliente_id = v_c.bono_cliente_id))
           order by re.clase_id
             for update of re
        loop
          update public.reservas set estado = 'cancelada', cancelled_at = now(), cancelacion_tardia = false where id = r.id;
          update public.clases set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0) where id = r.clase_id;
        end loop;
        perform set_config('ruleafit.bono_devolucion', '', true);
      else
        update public.cobros
           set estado = 'reembolsado_parcial',
               importe_devolver_centimos = coalesce(importe_devolver_centimos, 0) + v_k.importe_centimos,
               neto_devuelto_centimos = coalesce(neto_devuelto_centimos, 0) + v_quitar,
               updated_at = now()
         where id = v_c.id;
      end if;
    end if;
    if v_quitar > 0 then
      begin
        perform public.generar_notificacion(v_c.entrenador_id, 'liquidacion', 'Pago retirado por el banco',
          'El banco ha retirado un pago de un alumno. Hemos descontado '
          || replace(to_char(v_quitar / 100.0, 'FM999999990D00'), '.', ',') || ' € de tu saldo.', '/mis-ingresos');
      exception when others then null; end;
    end if;
  end if;

  update public.contracargos
     set estado = p_resultado, resuelto_en = now(), descontado_centimos = v_quitar
   where id = v_k.id;
  perform public.resolver_alerta_clave('contracargo:' || v_k.id);
  perform public.resolver_alerta_clave('contracargo:plazo:' || v_k.id);
  return jsonb_build_object('ok', true, 'resultado', p_resultado, 'descontado_centimos', v_quitar);
end;
$$;

-- Retención (versión de sql/108 + contracargo abierto).
create or replace function public.cobro_retenido(p_cobro_id uuid, p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contracargos k where k.cobro_id = p_cobro_id and k.estado = 'abierto'
  ) or exists (
    select 1 from public.incidencias_pago i
     where i.estado in ('abierta', 'en_revision')
       and (i.cobro_id = p_cobro_id or i.reserva_id = p_reserva_id)
  ) or exists (
    select 1 from public.cobros c
      join public.reservas r on r.bono_cliente_id = c.bono_cliente_id
      join public.incidencias_pago i on i.reserva_id = r.id
     where c.id = p_cobro_id and c.tipo = 'bono' and i.estado in ('abierta', 'en_revision')
  ) or exists (
    select 1 from public.cobros c join public.bonos_retenciones h on h.organizador_id = c.entrenador_id
     where c.id = p_cobro_id and c.tipo = 'bono' and h.levantada_en is null
  )
$$;

-- Reparto del corte (versión de sql/114 + contracargo abierto, también si el cobro ya se liquidó).
create or replace function public.liquidacion_cobros(p_fin date)
returns table (cobro_id uuid, entrenador_id uuid, liquidado boolean, motivo text, importe bigint)
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (select * from public.config_pagos where id),
  base as (
    select c.id, c.entrenador_id, c.liquidacion_id is not null as liquidado, c.estado, c.tipo,
           c.liberado_en, c.pagado_en, c.bono_cliente_id, c.reserva_id,
           (case when c.estado = 'reembolsado_parcial' then c.neto_centimos - coalesce(c.neto_devuelto_centimos, 0)
                 when c.estado = 'requiere_reembolso' and coalesce(c.neto_devuelto_centimos, 0) > 0 then c.neto_devuelto_centimos
                 else c.neto_centimos end)::bigint as importe
      from public.cobros c
     where c.liberado_en is not null and c.estado in ('pagado', 'reembolsado_parcial', 'requiere_reembolso')
  )
  select b.id, b.entrenador_id, b.liquidado,
         case
           when b.estado = 'requiere_reembolso' then 'en_devolucion'
           when exists (select 1 from public.contracargos k where k.cobro_id = b.id and k.estado = 'abierto') then 'retenido'
           when exists (select 1 from public.incidencias_pago i
                         where i.estado in ('abierta', 'en_revision')
                           and (i.cobro_id = b.id or i.reserva_id = b.reserva_id)) then 'retenido'
           when b.liquidado then null
           when public.cobro_retenido(b.id, b.reserva_id) then 'retenido'
           when b.tipo = 'bono' and not cfg.liquidar_bonos_en_plazo
                and (now() at time zone 'Europe/Madrid')::date
                    <= (b.pagado_en at time zone 'Europe/Madrid')::date + cfg.bono_desistimiento_dias
                and exists (select 1 from public.bonos_clientes bc
                             where bc.id = b.bono_cliente_id and bc.anulado_en is null and bc.fecha_fin >= now()
                               and public.bono_usadas(bc.id) * 100
                                   <= coalesce(bc.sesiones_total, 0) * cfg.bono_desistimiento_uso_max_pct) then 'bono_en_plazo'
           when (b.liberado_en at time zone 'Europe/Madrid')::date > p_fin then 'posterior_al_corte'
         end,
         b.importe
    from base b cross join cfg
$$;

-- Devolución de un cobro (versión de sql/096, renombrada por sql/107, + contracargo abierto).
create or replace function public.reclamar_devolucion_cobro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro public.cobros%rowtype;
  v_dev   public.devoluciones%rowtype;
begin
  select c.* into v_cobro
    from public.cobros c
    left join public.devoluciones d on d.cobro_id = c.id
   where c.estado = 'requiere_reembolso'
     and (d.id is null or (d.estado = 'fallida' and d.intentos < 5))
     -- sql/117: con un contracargo abierto no se pide la devolución (se pagaría dos veces).
     and not exists (select 1 from public.contracargos k where k.cobro_id = c.id and k.estado = 'abierto')
   order by c.updated_at
   limit 1
   for update of c skip locked;

  if not found then
    return jsonb_build_object('ok', true, 'resultado', 'nada_pendiente');
  end if;

  select * into v_dev from public.devoluciones where cobro_id = v_cobro.id for update;
  if not found then
    insert into public.devoluciones (cobro_id, importe_centimos)
    values (v_cobro.id, v_cobro.importe_centimos);
  else
    update public.devoluciones
       set estado = 'en_curso', intentos = intentos + 1, iniciada_en = now()
     where cobro_id = v_cobro.id;
  end if;

  return jsonb_build_object('ok', true, 'resultado', 'reclamada',
    'cobro_id', v_cobro.id, 'pedido', v_cobro.pedido_redsys,
    'importe_centimos', v_cobro.importe_centimos);
end;
$$;

-- Se llama junto a revisar_salud_pagos (sql/099) desde /api/alertas. Sus claves no se usan en ningún otro sitio.
create or replace function public.revisar_vigilancia()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
  r   record;
begin
  for r in
    select k.id, k.fecha_limite, c.pedido_redsys
      from public.contracargos k join public.cobros c on c.id = k.cobro_id
     where k.estado = 'abierto' and k.fecha_limite is not null
  loop
    perform public.alerta_segun(r.fecha_limite <= (now() at time zone 'Europe/Madrid')::date + 3, 'incidencias',
      'contracargo:plazo:' || r.id, 'critica',
      format('El plazo para responder al contracargo del pedido %s vence el %s.', r.pedido_redsys,
             to_char(r.fecha_limite, 'DD/MM/YYYY')));
  end loop;
  select count(*) into v_n
    from public.liquidaciones_lineas ll join public.liquidaciones l on l.id = ll.liquidacion_id
   where ll.estado = 'pendiente' and l.fecha_pago < (now() at time zone 'Europe/Madrid')::date - 2;
  perform public.alerta_segun(v_n > 0, 'liquidaciones', 'liquidaciones:sin_enviar', 'aviso',
    format('%s transferencias a organizadores siguen sin marcar como enviadas pasada su fecha.', v_n));
  select count(*) into v_n from public.bolsas where disponible_centimos < 0;
  perform public.alerta_segun(v_n > 0, 'liquidaciones', 'liquidaciones:saldo_negativo', 'aviso',
    format('%s organizadores tienen saldo negativo (se compensa con sus próximos ingresos).', v_n));
  update public.config_pagos set ultima_revision_en = now() where id;
  return jsonb_build_object('ok', true);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.registrar_contracargo(text, integer, text, text, date)', 'public.resolver_contracargo(uuid, text)',
    'public.cobro_retenido(uuid, uuid)', 'public.liquidacion_cobros(date)', 'public.reclamar_devolucion_cobro()',
    'public.revisar_vigilancia()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
