-- ============================================================================
-- Ruleafit · 116_facturas.sql  ·  Facturas de comisión y de Pro EN BORRADOR
-- Requiere sql/115. No activa pagos ni mueve dinero. Repetible.
--
-- Modelo decidido por el titular (28/11/2026, con su gestor): Ruleafit es INTERMEDIARIO y cobra en nombre y por cuenta
-- del organizador. Ruleafit solo factura SU COMISIÓN al organizador, y la suscripción Pro. No hay autofacturas.
-- El justificante o factura al alumno corresponde al organizador (sin hacer: por confirmar con el asesor).
--
-- ⚠ POR CONFIRMAR CON EL ASESOR. Mientras config_pagos.facturas_validadas sea false solo hay borradores: sin número,
--   sin validez y sin que el organizador los vea. Configurable en config_pagos:
--   · factura_iva_bps (2100 = 21 %). La comisión y Pro se tratan como IVA INCLUIDO (es lo que se descuenta o cobra).
--   · factura_ruleafit: {"nombre":"","nif":"","direccion":""}.
--   Organizadores de Canarias, Ceuta y Melilla: sin impuesto calculado y bloqueadas.
-- Factura de comisión: una por organizador y quincena, con los cobros cuyo dinero pasó a «disponible» en ella (cuando
--   la sesión ya se ha prestado), esté o no transferido. Serie COM-AAAA-NNNNNN. Solo quincenas ya terminadas.
-- Factura de Pro: una por mes cobrado. Serie PRO-AAAA-NNNNNN.
-- Devoluciones posteriores a la factura: necesitan rectificativa (SIN HACER; el panel las señala).
-- Reversión: sql/116_facturas_reversion.sql.
-- ============================================================================
alter table public.config_pagos
  add column if not exists facturas_validadas boolean not null default false,
  add column if not exists factura_iva_bps    integer not null default 2100 check (factura_iva_bps between 0 and 10000),
  add column if not exists factura_ruleafit   jsonb not null default '{}'::jsonb;

create table if not exists public.facturas (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('comision', 'pro')),
  estado          text not null default 'borrador' check (estado in ('borrador', 'emitida')),
  numero          text unique,
  usuario_id      uuid not null,  -- destinatario (organizador); sin FK: los registros fiscales se conservan
  periodo_inicio  date,
  periodo_fin     date,
  pago_pro_id     uuid unique references public.pagos_pro(id) on delete restrict,
  emisor          jsonb not null,
  receptor        jsonb not null,
  concepto        text not null,
  fecha_operacion date not null,
  base_centimos   bigint not null,
  iva_bps         integer not null,
  iva_centimos    bigint not null,
  total_centimos  bigint not null check (total_centimos > 0),
  detalle         jsonb not null default '[]'::jsonb,
  bloqueos        text[] not null default '{}',
  emitida_en      timestamptz,
  created_at      timestamptz not null default now(),
  constraint facturas_origen check (
    (tipo = 'comision') = (periodo_inicio is not null and periodo_fin is not null) and (tipo = 'pro') = (pago_pro_id is not null)),
  constraint facturas_numero check ((estado = 'borrador') = (numero is null)),
  constraint facturas_cuadra check (base_centimos + iva_centimos = total_centimos)
);
create index if not exists facturas_usuario_idx on public.facturas (usuario_id, created_at desc);
alter table public.facturas enable row level security;
revoke all on public.facturas from anon, authenticated; -- el organizador lee con mis_facturas()
grant select on public.facturas to service_role;

-- Cada cobro entra en una sola factura de comisión emitida.
alter table public.cobros add column if not exists factura_comision_id uuid references public.facturas(id) on delete restrict;

-- Numeración correlativa y sin saltos: se toma dentro de la misma transacción que emite.
create table if not exists public.facturas_contadores (
  serie  text not null,
  anio   integer not null,
  ultimo integer not null default 0,
  primary key (serie, anio)
);
alter table public.facturas_contadores enable row level security;
revoke all on public.facturas_contadores from anon, authenticated;

-- Una factura emitida no se cambia ni se borra.
create or replace function public.factura_emitida_inmutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'borrador' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Una factura emitida no se puede modificar ni borrar.' using errcode = 'P0001';
end;
$$;
drop trigger if exists trg_factura_emitida_inmutable on public.facturas;
create trigger trg_factura_emitida_inmutable before update or delete on public.facturas
  for each row execute function public.factura_emitida_inmutable();

-- Comisión que queda de cada cobro ya prestado y sin facturar, con su quincena. Interna.
create or replace function public.comisiones_sin_facturar()
returns table (cobro_id uuid, usuario_id uuid, inicio date, fin date, cobrado bigint, comision bigint, concepto text, liberado timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select c.id, c.entrenador_id, c.liberado_en, (c.liberado_en at time zone 'Europe/Madrid')::date as dia,
           (case when c.estado = 'reembolsado_parcial' then c.importe_centimos - coalesce(c.importe_devolver_centimos, 0)
                 else c.importe_centimos end)::bigint as cobrado,
           (case when c.estado = 'reembolsado_parcial'
                 then (c.importe_centimos - coalesce(c.importe_devolver_centimos, 0))
                      - (c.neto_centimos - coalesce(c.neto_devuelto_centimos, 0))
                 else c.comision_centimos end)::bigint as comision,
           coalesce(cl.titulo, c.clase_titulo, 'Sesión') as concepto
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.liberado_en is not null and c.estado in ('pagado', 'reembolsado_parcial')
       and c.factura_comision_id is null and c.entrenador_id is not null
  )
  select b.id, b.entrenador_id,
         case when extract(day from b.dia) <= 15 then date_trunc('month', b.dia)::date
              else date_trunc('month', b.dia)::date + 15 end,
         case when extract(day from b.dia) <= 15 then date_trunc('month', b.dia)::date + 14
              else (date_trunc('month', b.dia) + interval '1 month - 1 day')::date end,
         b.cobrado, b.comision, b.concepto, b.liberado_en
    from base b
   where b.comision > 0
$$;

-- Rehace TODOS los borradores con los datos y ajustes actuales. No toca las emitidas.
create or replace function public.generar_borradores_facturas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg    public.config_pagos%rowtype;
  v_rf     jsonb;
  v_sin_rf boolean;
  v_hoy    date := (now() at time zone 'Europe/Madrid')::date;
  r        record;
  f        public.perfiles_fiscales%rowtype;
  v_org    jsonb;
  v_base   bigint;
  v_iva    integer;
  v_blq    text[];
  v_n      integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('facturas'));
  select * into v_cfg from public.config_pagos where id;
  v_rf := jsonb_build_object('nombre', coalesce(v_cfg.factura_ruleafit ->> 'nombre', ''),
                             'nif', coalesce(v_cfg.factura_ruleafit ->> 'nif', ''),
                             'direccion', coalesce(v_cfg.factura_ruleafit ->> 'direccion', ''));
  v_sin_rf := btrim(v_rf ->> 'nombre') = '' or btrim(v_rf ->> 'nif') = '' or btrim(v_rf ->> 'direccion') = '';
  delete from public.facturas where estado = 'borrador';

  for r in
    select 'comision'::text as tipo, x.usuario_id, x.inicio, x.fin, null::uuid as pago_pro_id,
           sum(x.comision)::bigint as importe, x.fin as fecha,
           'Comisión de intermediación por las reservas cobradas en tu nombre · del ' || to_char(x.inicio, 'DD/MM/YYYY')
             || ' al ' || to_char(x.fin, 'DD/MM/YYYY') as concepto,
           jsonb_agg(jsonb_build_object('cobro_id', x.cobro_id, 'concepto', x.concepto, 'cobrado_centimos', x.cobrado,
                                        'comision_centimos', x.comision) order by x.liberado, x.cobro_id) as detalle
      from public.comisiones_sin_facturar() x
     where x.fin < v_hoy
       -- Si esa quincena ya tiene factura emitida, lo que falte necesita revisión manual.
       and not exists (select 1 from public.facturas e where e.estado = 'emitida' and e.tipo = 'comision'
                        and e.usuario_id = x.usuario_id and e.periodo_fin = x.fin)
     group by x.usuario_id, x.inicio, x.fin
    union all
    select 'pro', p.usuario_id, null, null, p.id, p.importe_centimos::bigint,
           (p.pagado_en at time zone 'Europe/Madrid')::date,
           'Suscripción Ruleafit Pro · ' || to_char(p.periodo_inicio at time zone 'Europe/Madrid', 'DD/MM/YYYY') || ' al '
             || to_char(p.periodo_fin at time zone 'Europe/Madrid', 'DD/MM/YYYY'), '[]'::jsonb
      from public.pagos_pro p
     where p.estado = 'pagado' and p.usuario_id is not null
       and not exists (select 1 from public.facturas e where e.pago_pro_id = p.id)
  loop
    select * into f from public.perfiles_fiscales where usuario_id = r.usuario_id;
    v_blq := '{}';
    if f.usuario_id is null then
      v_blq := array_append(v_blq, 'sin_datos_organizador');
      v_org := jsonb_build_object('nombre', '', 'nif', '', 'direccion', '');
    else
      v_org := jsonb_build_object('nombre', f.nombre_fiscal, 'nif', f.nif,
        'direccion', f.direccion || ', ' || f.codigo_postal || ' ' || f.municipio || ' (' || f.provincia || ')');
    end if;
    if v_sin_rf then v_blq := array_append(v_blq, 'sin_datos_ruleafit'); end if;
    v_iva := v_cfg.factura_iva_bps;
    if f.zona_fiscal in ('canarias', 'ceuta_melilla') then
      v_iva := 0;
      v_blq := array_append(v_blq, 'zona_especial');
    end if;
    v_base := floor((r.importe::numeric * 10000) / (10000 + v_iva) + 0.5);
    insert into public.facturas (tipo, usuario_id, periodo_inicio, periodo_fin, pago_pro_id, emisor, receptor, concepto,
      fecha_operacion, base_centimos, iva_bps, iva_centimos, total_centimos, detalle, bloqueos)
    values (r.tipo, r.usuario_id, r.inicio, r.fin, r.pago_pro_id, v_rf, v_org, r.concepto, r.fecha,
      v_base, v_iva, r.importe - v_base, r.importe, r.detalle, v_blq);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'borradores', v_n);
end;
$$;

create or replace function public.emitir_factura(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f      public.facturas%rowtype;
  v_ids    uuid[];
  v_total  bigint;
  v_serie  text;
  v_anio   integer := extract(year from now() at time zone 'Europe/Madrid');
  v_n      integer;
  v_num    text;
begin
  perform pg_advisory_xact_lock(hashtext('facturas'));
  if not (select facturas_validadas from public.config_pagos where id) then
    raise exception 'La facturación aún no está validada por el asesor: solo hay borradores.' using errcode = 'P0001';
  end if;
  select * into v_f from public.facturas where id = p_id for update;
  if not found or v_f.estado <> 'borrador' then
    raise exception 'Solo se puede emitir un borrador.' using errcode = 'P0001';
  end if;
  if cardinality(v_f.bloqueos) > 0 then
    raise exception 'Este borrador tiene datos pendientes y no se puede emitir.' using errcode = 'P0001';
  end if;
  if v_f.tipo = 'comision' then
    v_ids := array(select (d ->> 'cobro_id')::uuid from jsonb_array_elements(v_f.detalle) d);
    perform 1 from public.cobros where id = any (v_ids) order by id for update;
    select coalesce(sum(x.comision), 0) into v_total from public.comisiones_sin_facturar() x where x.cobro_id = any (v_ids);
    if v_total <> v_f.total_centimos then
      raise exception 'Algún cobro ha cambiado desde que se preparó: actualiza los borradores.' using errcode = 'P0001';
    end if;
  elsif not exists (select 1 from public.pagos_pro where id = v_f.pago_pro_id and estado = 'pagado') then
    raise exception 'Ese pago de Pro ha cambiado: actualiza los borradores.' using errcode = 'P0001';
  end if;
  v_serie := case v_f.tipo when 'pro' then 'PRO' else 'COM' end;
  insert into public.facturas_contadores (serie, anio, ultimo) values (v_serie, v_anio, 1)
  on conflict (serie, anio) do update set ultimo = facturas_contadores.ultimo + 1
  returning ultimo into v_n;
  v_num := v_serie || '-' || v_anio || '-' || lpad(v_n::text, 6, '0');
  update public.facturas set estado = 'emitida', numero = v_num, emitida_en = now() where id = p_id;
  update public.cobros set factura_comision_id = p_id where id = any (v_ids);
  begin
    perform public.generar_notificacion(v_f.usuario_id, 'factura', 'Tienes una factura nueva',
      'Factura ' || v_num || '. Puedes verla en Mis ingresos.', '/mis-ingresos');
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'numero', v_num);
end;
$$;

-- Facturas emitidas a quien consulta.
create or replace function public.mis_facturas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg((to_jsonb(f) - 'usuario_id' - 'bloqueos' - 'pago_pro_id') order by f.emitida_en desc, f.numero desc)
      from public.facturas f where f.usuario_id = auth.uid() and f.estado = 'emitida'), '[]'::jsonb);
end;
$$;

revoke all on function public.factura_emitida_inmutable(), public.comisiones_sin_facturar(),
  public.generar_borradores_facturas(), public.emitir_factura(uuid), public.mis_facturas() from public, anon, authenticated;
grant execute on function public.generar_borradores_facturas(), public.emitir_factura(uuid) to service_role;
grant execute on function public.mis_facturas() to authenticated;
