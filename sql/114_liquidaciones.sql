-- ============================================================================
-- Ruleafit · 114_liquidaciones.sql
-- Requiere sql/107. No activa pagos ni envía dinero: calcula, anota y deja constancia de transferencias que se hacen
-- fuera (el fichero bancario es otro paso). Repetible.
--
-- Reglas (docs/REGLAS_PAGOS_RULEAFIT.md): cortes los días 15 y último de cada mes; pago ese día o el siguiente
-- laborable (solo se saltan sábados y domingos: ⚠ POR CONFIRMAR con el banco el calendario de festivos); mínimo
-- config_pagos.minimo_liquidacion_centimos (10 €), lo demás se acumula.
-- De la bolsa «disponible» NO se paga:
--   · lo que tenga una reclamación abierta o en revisión, o una retención de bonos;
--   · lo que esté pendiente de devolver;
--   · bonos que el alumno aún puede devolver por desistimiento (⚠ POR CONFIRMAR con el asesor; se cambia con
--     config_pagos.liquidar_bonos_en_plazo = true);
--   · lo liberado después de la fecha de corte.
-- Un saldo negativo se compensa con ingresos futuros (⚠ POR DECIDIR qué hacer si el organizador no vuelve).
-- Solo cobra quien tiene datos fiscales «activo» e IBAN.
-- Reversión: sql/114_liquidaciones_reversion.sql.
-- ============================================================================
alter table public.config_pagos add column if not exists liquidar_bonos_en_plazo boolean not null default false;
alter table public.cobros add column if not exists liquidacion_id uuid references public.liquidaciones(id) on delete set null;
alter table public.liquidaciones_lineas drop constraint if exists liquidaciones_lineas_estado_check;
alter table public.liquidaciones_lineas add constraint liquidaciones_lineas_estado_check
  check (estado in ('pendiente', 'pagada', 'anulada'));

-- Último corte (15 o fin de mes) que ya ha llegado.
create or replace function public.liquidacion_periodo(p_hoy date)
returns table (inicio date, fin date, pago date)
language sql
immutable
as $$
  with f as (
    select case
             when p_hoy = (date_trunc('month', p_hoy) + interval '1 month - 1 day')::date then p_hoy
             when extract(day from p_hoy) >= 15 then date_trunc('month', p_hoy)::date + 14
             else date_trunc('month', p_hoy)::date - 1
           end as fin
  )
  select case when extract(day from f.fin) = 15 then date_trunc('month', f.fin)::date
              else date_trunc('month', f.fin)::date + 15 end,
         f.fin,
         f.fin + case extract(isodow from f.fin)::integer when 6 then 2 when 7 then 1 else 0 end
    from f
$$;

-- Cobros ya liberados de la bolsa con el motivo por el que hoy no se pueden pagar (null = se puede). Interna.
-- Una reclamación o una devolución pendiente cuentan aunque el cobro ya se hubiera liquidado: se descontarían después.
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

-- Lo que correspondería pagar a cada organizador con saldo. Interna.
create or replace function public.liquidacion_calcular(p_fin date)
returns table (
  entrenador_id uuid, disponible bigint, retenido bigint, en_devolucion bigint, bonos_en_plazo bigint,
  posterior bigint, a_pagar bigint, iban_ultimos4 text, motivo text
)
language sql
stable
security definer
set search_path = public
as $$
  with partes as (
    select k.entrenador_id,
           coalesce(sum(k.importe) filter (where k.motivo = 'retenido'), 0)::bigint as retenido,
           coalesce(sum(k.importe) filter (where k.motivo = 'en_devolucion'), 0)::bigint as en_devolucion,
           coalesce(sum(k.importe) filter (where k.motivo = 'bono_en_plazo'), 0)::bigint as bonos_en_plazo,
           coalesce(sum(k.importe) filter (where k.motivo = 'posterior_al_corte'), 0)::bigint as posterior
      from public.liquidacion_cobros(p_fin) k
     group by k.entrenador_id
  ), calculo as (
    select b.entrenador_id, b.disponible_centimos as disponible,
           coalesce(p.retenido, 0) as retenido, coalesce(p.en_devolucion, 0) as en_devolucion,
           coalesce(p.bonos_en_plazo, 0) as bonos_en_plazo, coalesce(p.posterior, 0) as posterior,
           b.disponible_centimos - coalesce(p.retenido, 0) - coalesce(p.en_devolucion, 0)
             - coalesce(p.bonos_en_plazo, 0) - coalesce(p.posterior, 0) as a_pagar
      from public.bolsas b
      left join partes p on p.entrenador_id = b.entrenador_id
     where b.disponible_centimos <> 0
  )
  select c.entrenador_id, c.disponible, c.retenido, c.en_devolucion, c.bonos_en_plazo, c.posterior,
         greatest(c.a_pagar, 0)::bigint, f.iban_ultimos4,
         case
           when c.a_pagar <= 0 then 'sin_saldo'
           when f.usuario_id is null or f.estado <> 'activo' then 'datos_fiscales'
           when f.iban_cifrado is null then 'sin_iban'
           when c.a_pagar < (select minimo_liquidacion_centimos from public.config_pagos where id) then 'bajo_minimo'
         end
    from calculo c
    left join public.perfiles_fiscales f on f.usuario_id = c.entrenador_id
$$;

-- Datos del panel de administración (solo lectura).
create or replace function public.panel_liquidaciones()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p record;
  v_cfg public.config_pagos%rowtype;
begin
  select * into v_p from public.liquidacion_periodo((now() at time zone 'Europe/Madrid')::date);
  select * into v_cfg from public.config_pagos where id;
  return jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_p.inicio, 'fin', v_p.fin, 'pago', v_p.pago),
    'minimo_centimos', v_cfg.minimo_liquidacion_centimos,
    'liquidar_bonos_en_plazo', v_cfg.liquidar_bonos_en_plazo,
    'prevision', coalesce((
      select jsonb_agg(to_jsonb(x) || jsonb_build_object('username', pe.username,
               'ya_incluido', exists (select 1 from public.liquidaciones l join public.liquidaciones_lineas ll on ll.liquidacion_id = l.id
                                       where l.periodo_inicio = v_p.inicio and l.periodo_fin = v_p.fin
                                         and ll.entrenador_id = x.entrenador_id and ll.estado <> 'anulada'))
             order by x.a_pagar desc, pe.username)
        from public.liquidacion_calcular(v_p.fin) x
        left join public.perfiles pe on pe.id = x.entrenador_id), '[]'::jsonb),
    'lineas', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.fecha_pago desc, y.username)
        from (select ll.id, ll.importe_centimos, ll.estado, ll.iban_ultimos4, l.periodo_inicio, l.periodo_fin,
                     l.fecha_pago, pe.username
                from public.liquidaciones_lineas ll
                join public.liquidaciones l on l.id = ll.liquidacion_id
                left join public.perfiles pe on pe.id = ll.entrenador_id
               order by l.fecha_pago desc, ll.created_at desc limit 200) y), '[]'::jsonb)
  );
end;
$$;

-- Cierra el último corte: una línea por organizador con importe pagable; el dinero sale de «disponible».
-- Se puede repetir: solo añade a quien todavía no esté (o tenga la línea anulada).
create or replace function public.cerrar_liquidacion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p      record;
  v_liq    uuid;
  r        record;
  v_n      integer := 0;
  v_total  bigint := 0;
begin
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  perform 1 from public.bolsas order by entrenador_id for update; -- nadie mueve saldos mientras se cierra
  select * into v_p from public.liquidacion_periodo((now() at time zone 'Europe/Madrid')::date);

  insert into public.liquidaciones (periodo_inicio, periodo_fin, fecha_pago, estado, cerrada_en)
  values (v_p.inicio, v_p.fin, v_p.pago, 'cerrada', now())
  on conflict (periodo_inicio, periodo_fin) do nothing;
  select id into v_liq from public.liquidaciones where periodo_inicio = v_p.inicio and periodo_fin = v_p.fin;

  for r in
    select x.* from public.liquidacion_calcular(v_p.fin) x
     where x.motivo is null
       and not exists (select 1 from public.liquidaciones_lineas ll
                        where ll.liquidacion_id = v_liq and ll.entrenador_id = x.entrenador_id and ll.estado <> 'anulada')
     order by x.entrenador_id
  loop
    -- Se anota qué cobros quedan pagados con esta liquidación (antes de mover el saldo).
    update public.cobros c set liquidacion_id = v_liq
      from public.liquidacion_cobros(v_p.fin) k
     where k.cobro_id = c.id and k.entrenador_id = r.entrenador_id and k.motivo is null and not k.liquidado;
    insert into public.liquidaciones_lineas (liquidacion_id, entrenador_id, importe_centimos, iban_ultimos4)
    values (v_liq, r.entrenador_id, r.a_pagar, r.iban_ultimos4)
    on conflict (liquidacion_id, entrenador_id)
    do update set importe_centimos = excluded.importe_centimos, iban_ultimos4 = excluded.iban_ultimos4, estado = 'pendiente';
    insert into public.movimientos_bolsa (entrenador_id, liquidacion_id, tipo, bolsa, importe_centimos, nota)
    values (r.entrenador_id, v_liq, 'liquidacion', 'disponible', -r.a_pagar,
            'Liquidación del ' || to_char(v_p.pago, 'DD/MM/YYYY'));
    update public.bolsas set disponible_centimos = disponible_centimos - r.a_pagar where entrenador_id = r.entrenador_id;
    v_n := v_n + 1;
    v_total := v_total + r.a_pagar;
  end loop;

  if v_n = 0 then
    raise exception 'No hay ningún importe nuevo que liquidar en este corte.' using errcode = 'P0001';
  end if;
  update public.liquidaciones
     set estado = 'cerrada',
         total_centimos = (select coalesce(sum(importe_centimos), 0) from public.liquidaciones_lineas
                            where liquidacion_id = v_liq and estado <> 'anulada')
   where id = v_liq;
  return jsonb_build_object('ok', true, 'liquidacion_id', v_liq, 'lineas', v_n, 'total_centimos', v_total);
end;
$$;

-- «pagada»: la transferencia se ha hecho. «anulada»: no se ha hecho o el banco la ha devuelto; el dinero vuelve.
create or replace function public.marcar_linea_liquidacion(p_linea uuid, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l public.liquidaciones_lineas%rowtype;
begin
  if p_estado not in ('pagada', 'anulada') then
    raise exception 'Estado no válido.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('liquidaciones'));
  select * into v_l from public.liquidaciones_lineas where id = p_linea for update;
  if not found then
    raise exception 'La transferencia no existe.' using errcode = 'P0002';
  end if;
  if v_l.estado <> 'pendiente' then
    raise exception 'Esta transferencia ya está marcada como %.', v_l.estado using errcode = 'P0001';
  end if;
  update public.liquidaciones_lineas set estado = p_estado where id = p_linea;
  if p_estado = 'anulada' then
    insert into public.movimientos_bolsa (entrenador_id, liquidacion_id, tipo, bolsa, importe_centimos, nota)
    values (v_l.entrenador_id, v_l.liquidacion_id, 'ajuste', 'disponible', v_l.importe_centimos, 'Liquidación anulada');
    update public.bolsas set disponible_centimos = disponible_centimos + v_l.importe_centimos
     where entrenador_id = v_l.entrenador_id;
    update public.cobros set liquidacion_id = null
     where liquidacion_id = v_l.liquidacion_id and entrenador_id = v_l.entrenador_id;
  else
    begin
      perform public.generar_notificacion(v_l.entrenador_id, 'liquidacion', 'Transferencia enviada',
        'Te hemos enviado ' || to_char(v_l.importe_centimos / 100.0, 'FM999999990D00') || ' € a tu cuenta.', '/mis-ingresos');
    exception when others then null; end;
  end if;
  update public.liquidaciones l
     set total_centimos = (select coalesce(sum(importe_centimos), 0) from public.liquidaciones_lineas
                            where liquidacion_id = l.id and estado <> 'anulada'),
         estado = case when exists (select 1 from public.liquidaciones_lineas where liquidacion_id = l.id and estado = 'pagada')
                        and not exists (select 1 from public.liquidaciones_lineas where liquidacion_id = l.id and estado = 'pendiente')
                       then 'pagada' else 'cerrada' end
   where l.id = v_l.liquidacion_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Datos para hacer UNA transferencia pendiente. Descifra el IBAN: solo servidor, a petición de administración.
create or replace function public.datos_transferencia(p_linea uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l     public.liquidaciones_lineas%rowtype;
  v_f     public.perfiles_fiscales%rowtype;
  v_pago  date;
  v_clave text;
begin
  select * into v_l from public.liquidaciones_lineas where id = p_linea;
  if not found or v_l.estado <> 'pendiente' then
    raise exception 'Solo se muestran los datos de una transferencia pendiente.' using errcode = 'P0001';
  end if;
  select * into v_f from public.perfiles_fiscales where usuario_id = v_l.entrenador_id;
  if not found or v_f.iban_cifrado is null or v_f.estado <> 'activo' then
    raise exception 'El organizador ya no tiene datos fiscales aprobados con IBAN.' using errcode = 'P0001';
  end if;
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'iban_clave';
  select fecha_pago into v_pago from public.liquidaciones where id = v_l.liquidacion_id;
  return jsonb_build_object(
    'titular', v_f.titular_iban,
    'iban', extensions.pgp_sym_decrypt(v_f.iban_cifrado, v_clave),
    'iban_cambiado', v_f.iban_ultimos4 is distinct from v_l.iban_ultimos4,
    'importe_centimos', v_l.importe_centimos,
    'concepto', 'RULEAFIT liquidacion ' || to_char(v_pago, 'DD-MM-YYYY'));
end;
$$;

revoke all on function public.liquidacion_periodo(date), public.liquidacion_cobros(date), public.liquidacion_calcular(date),
  public.panel_liquidaciones(), public.cerrar_liquidacion(), public.marcar_linea_liquidacion(uuid, text),
  public.datos_transferencia(uuid) from public, anon, authenticated;
grant execute on function public.panel_liquidaciones(), public.cerrar_liquidacion(),
  public.marcar_linea_liquidacion(uuid, text), public.datos_transferencia(uuid) to service_role;
grant select on public.liquidaciones, public.liquidaciones_lineas to service_role;
