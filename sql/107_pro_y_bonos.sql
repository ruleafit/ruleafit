-- ============================================================================
-- Ruleafit · 107_pro_y_bonos.sql
-- Plan Pro (suscripción del organizador) y bonos con pago online. Requiere sql/063, 071-073, 086, 087 y 095-106.
-- Reglas: docs/REGLAS_PAGOS_RULEAFIT.md, apartado 12.
--
-- NO activa pagos. Con config_pagos.pagos_activos = false no cambia nada de lo que se ve: los bonos se crean y se
-- adquieren como hasta ahora. Con pagos activos:
--   · crear o reactivar un bono exige Pro activo y datos fiscales aprobados; sesiones cerradas; 30 días o sin caducidad;
--   · un bono solo se adquiere pagándolo (sustituye al bloqueo total de sql/106).
-- Sustituye (versión vigente desde aquí): liberar_pendientes, cobro_retenido, mis_ingresos, abrir_incidencia_cobro.
-- Envuelve: confirmar_cobro_pagado, reclamar_devolucion, completar_devolucion, devolver_y_cerrar_incidencia,
-- eliminar_mi_cuenta. No volver a ejecutar 096, 103 o 105 después de este archivo. Repetible.
-- Antes de activar pagos en producción: sql/107_pro_y_bonos_preactivacion.sql.
-- Reversión: sql/107_pro_y_bonos_reversion.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Valores configurables
-- ----------------------------------------------------------------------------
alter table public.config_pagos
  add column if not exists pro_precio_centimos             integer not null default 4000 check (pro_precio_centimos > 0),
  add column if not exists pro_gracia_dias                 integer not null default 3 check (pro_gracia_dias >= 0),
  add column if not exists pro_desistimiento_dias          integer not null default 14 check (pro_desistimiento_dias >= 0),
  add column if not exists comision_bonos_bps              integer not null default 0 check (comision_bonos_bps between 0 and 10000),
  add column if not exists bono_desistimiento_dias         integer not null default 14 check (bono_desistimiento_dias >= 0),
  add column if not exists bono_desistimiento_uso_max_pct  integer not null default 25 check (bono_desistimiento_uso_max_pct between 0 and 100),
  add column if not exists bono_cancelaciones_limite       integer not null default 3 check (bono_cancelaciones_limite > 0),
  add column if not exists bono_cancelaciones_dias         integer not null default 30 check (bono_cancelaciones_dias > 0);

-- ----------------------------------------------------------------------------
-- 2) Tablas
-- ----------------------------------------------------------------------------
-- reglas_version = 2: bono creado bajo estas reglas (el único que se puede vender online).
alter table public.bonos add column if not exists reglas_version smallint;
-- plazo_dias = 0 significa «sin caducidad».
alter table public.bonos drop constraint if exists bonos_plazo_dias_positivo;
alter table public.bonos add constraint bonos_plazo_dias_positivo check (plazo_dias >= 0);

-- Foto de lo comprado: la devolución se calcula con esto aunque el bono cambie después.
alter table public.bonos_clientes
  add column if not exists sesiones_total   integer,
  add column if not exists anulado_en       timestamptz,
  add column if not exists anulado_motivo   text;

alter table public.cobros
  add column if not exists tipo                     text not null default 'sesion',
  add column if not exists bono_id                  uuid references public.bonos(id) on delete set null,
  add column if not exists bono_cliente_id          uuid references public.bonos_clientes(id) on delete set null,
  -- Devolución parcial: lo que se devuelve al alumno y la parte que sale de la bolsa del organizador.
  add column if not exists importe_devolver_centimos integer check (importe_devolver_centimos > 0),
  add column if not exists neto_devuelto_centimos    integer check (neto_devuelto_centimos >= 0);
alter table public.cobros drop constraint if exists cobros_tipo_check;
alter table public.cobros add constraint cobros_tipo_check check (tipo in ('sesion', 'bono'));
alter table public.cobros drop constraint if exists cobros_estado_check;
alter table public.cobros add constraint cobros_estado_check
  check (estado in ('creado', 'pagado', 'fallido', 'requiere_reembolso', 'reembolsado', 'reembolsado_parcial', 'caducado'));
create index if not exists cobros_bono_cliente_idx on public.cobros (bono_cliente_id) where bono_cliente_id is not null;

-- Una fila por organizador. Guarda la referencia de la tarjeta: solo el servicio puede leerla.
create table if not exists public.suscripciones_pro (
  usuario_id            uuid primary key,
  estado                text not null check (estado in ('activa', 'impagada', 'caducada')),
  renovacion            boolean not null default true,
  periodo_inicio        timestamptz not null,
  periodo_fin           timestamptz not null,
  primer_alta_en        timestamptz not null,
  cancelada_en          timestamptz,
  identificador_tarjeta text,
  cof_txnid             text,
  ultimo_intento_en     timestamptz,
  updated_at            timestamptz not null default now()
);

-- Cobros de Ruleafit al organizador (no pasan por la bolsa).
create table if not exists public.pagos_pro (
  id                        uuid primary key default gen_random_uuid(),
  usuario_id                uuid not null,
  tipo                      text not null check (tipo in ('alta', 'renovacion')),
  estado                    text not null default 'creado'
                              check (estado in ('creado', 'dudoso', 'pagado', 'fallido', 'caducado',
                                                'requiere_reembolso', 'reembolsado', 'reembolsado_parcial')),
  pedido_redsys             text not null unique check (pedido_redsys ~ '^[0-9]{4}[0-9A-Za-z]{0,8}$'),
  importe_centimos          integer not null check (importe_centimos > 0),
  importe_devolver_centimos integer check (importe_devolver_centimos > 0),
  periodo_inicio            timestamptz,
  periodo_fin               timestamptz,
  codigo_respuesta          text,
  devolucion_estado         text check (devolucion_estado in ('en_curso', 'completada', 'fallida')),
  devolucion_intentos       integer not null default 0,
  pagado_en                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists pagos_pro_usuario_idx on public.pagos_pro (usuario_id, created_at desc);

-- Sesiones con alumnos de bono canceladas por quien organiza, y retenciones del saldo de bonos.
create table if not exists public.bonos_cancelaciones (
  organizador_id uuid not null,
  clase_id       uuid not null,
  created_at     timestamptz not null default now(),
  primary key (organizador_id, clase_id)
);
create table if not exists public.bonos_retenciones (
  id             uuid primary key default gen_random_uuid(),
  organizador_id uuid not null,
  motivo         text not null,
  created_at     timestamptz not null default now(),
  levantada_en   timestamptz
);
create unique index if not exists bonos_retenciones_abierta on public.bonos_retenciones (organizador_id) where levantada_en is null;

alter table public.suscripciones_pro   enable row level security;
alter table public.pagos_pro           enable row level security;
alter table public.bonos_cancelaciones enable row level security;
alter table public.bonos_retenciones   enable row level security;
revoke all on public.suscripciones_pro, public.pagos_pro, public.bonos_cancelaciones, public.bonos_retenciones
  from anon, authenticated;
grant select, insert, update, delete on
  public.suscripciones_pro, public.pagos_pro, public.bonos_cancelaciones, public.bonos_retenciones to service_role;

-- ----------------------------------------------------------------------------
-- 3) Reglas de venta
-- ----------------------------------------------------------------------------
create or replace function public.pro_activo(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suscripciones_pro s, public.config_pagos c
     where c.id and s.usuario_id = p_usuario and s.estado <> 'caducada'
       and now() < s.periodo_fin + make_interval(days => case when s.renovacion then c.pro_gracia_dias else 0 end)
  )
$$;

create or replace function public.puede_vender_bonos(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pro_activo(p_usuario)
     and exists (select 1 from public.perfiles_fiscales where usuario_id = p_usuario and estado = 'activo')
$$;

create or replace function public.validar_bono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activos  boolean;
  v_cambia   boolean;
begin
  select pagos_activos into v_activos from public.config_pagos where id;
  -- La marca de reglas la pone solo la base de datos.
  if tg_op = 'UPDATE' then new.reglas_version := old.reglas_version; else new.reglas_version := null; end if;
  if not coalesce(v_activos, false) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_cambia := new.numero_sesiones is distinct from old.numero_sesiones
             or new.precio is distinct from old.precio
             or new.plazo_dias is distinct from old.plazo_dias
             or new.trainer_id is distinct from old.trainer_id;
    if v_cambia and exists (select 1 from public.bonos_clientes where bono_id = old.id) then
      raise exception 'Este bono ya se ha vendido: no se puede cambiar. Desactívalo y crea otro.' using errcode = 'P0001';
    end if;
    -- Desactivar, o cambiar la descripción, siempre se puede.
    if not v_cambia and not (new.activo and not old.activo) then
      return new;
    end if;
    if new.activo and not old.activo and old.reglas_version is distinct from 2 then
      raise exception 'Este bono es anterior a la venta online y no se puede reactivar. Crea uno nuevo.' using errcode = 'P0001';
    end if;
  end if;

  if not public.pro_activo(new.trainer_id) then
    raise exception 'Para crear o vender bonos necesitas la suscripción Pro activa.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfiles_fiscales where usuario_id = new.trainer_id and estado = 'activo') then
    raise exception 'Para vender bonos necesitas tus datos fiscales aprobados (Mi cuenta → Datos fiscales y cobros).' using errcode = 'P0001';
  end if;
  if new.numero_sesiones is null then
    raise exception 'Los bonos online tienen un número cerrado de sesiones.' using errcode = 'P0001';
  end if;
  if new.plazo_dias not in (0, 30) then
    raise exception 'El bono dura 30 días o no caduca.' using errcode = 'P0001';
  end if;
  if coalesce(new.precio, 0) <= 0 then
    raise exception 'El precio del bono debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or v_cambia then
    new.reglas_version := 2;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_validar_bono on public.bonos;
create trigger trg_validar_bono before insert or update on public.bonos
  for each row execute function public.validar_bono();

-- Sustituye a sql/106: con pagos activos solo la confirmación del pago crea la adquisición.
drop trigger if exists trg_impedir_bono_con_pagos on public.bonos_clientes;
drop function if exists public.impedir_bono_con_pagos();
create or replace function public.impedir_bono_sin_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.config_pagos where id and pagos_activos)
     and coalesce(current_setting('ruleafit.bono_pagado', true), '') <> '1' then
    raise exception 'El bono se adquiere pagándolo online desde el perfil de quien organiza.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_impedir_bono_sin_pago on public.bonos_clientes;
create trigger trg_impedir_bono_sin_pago before insert on public.bonos_clientes
  for each row execute function public.impedir_bono_sin_pago();

-- Qué bonos de un organizador se pueden comprar ahora mismo.
create or replace function public.bonos_a_la_venta(p_trainer uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id from public.bonos b
   where b.trainer_id = p_trainer and b.activo and b.reglas_version = 2 and b.numero_sesiones is not null
     and public.puede_vender_bonos(p_trainer)
$$;

-- ----------------------------------------------------------------------------
-- 4) Compra de un bono
-- ----------------------------------------------------------------------------
create or replace function public.crear_cobro_bono(p_bono_id uuid, p_pedido text, p_metodo text default 'tarjeta')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario  uuid := auth.uid();
  v_cfg      public.config_pagos%rowtype;
  v_bono     public.bonos%rowtype;
  v_previo   public.cobros%rowtype;
  v_importe  integer;
  v_comision integer;
  v_id       uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para pagar.' using errcode = '28000';
  end if;
  if p_metodo not in ('tarjeta', 'bizum') then
    raise exception 'Método de pago no válido.' using errcode = 'P0001';
  end if;
  select * into v_cfg from public.config_pagos where id;
  if not found or not v_cfg.pagos_activos then
    raise exception 'Los pagos online no están activados todavía.' using errcode = 'P0001';
  end if;
  if v_cfg.parada_cobros then
    raise exception 'Los pagos online están en pausa temporalmente. No se te ha cobrado nada. Inténtalo más tarde.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('cobro-bono:' || v_usuario::text || ':' || coalesce(p_bono_id::text, '')));

  select * into v_bono from public.bonos where id = p_bono_id;
  if not found then
    raise exception 'El bono no existe.' using errcode = 'P0002';
  end if;
  if v_bono.trainer_id = v_usuario then
    raise exception 'No puedes adquirir tu propio bono.' using errcode = '42501';
  end if;
  if exists (select 1 from public.bloqueos where bloqueador_id = v_bono.trainer_id and bloqueado_id = v_usuario) then
    raise exception 'Este bono no está disponible para ti.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bonos_a_la_venta(v_bono.trainer_id) x where x = v_bono.id) then
    raise exception 'Este bono ya no está a la venta.' using errcode = 'P0001';
  end if;
  v_importe := round(v_bono.precio * 100)::integer;
  v_comision := floor((v_importe::numeric * v_cfg.comision_bonos_bps + 5000) / 10000)::integer;

  update public.cobros set estado = 'caducado'
   where cliente_id = v_usuario and bono_id = p_bono_id and estado = 'creado'
     and (created_at <= now() - interval '30 minutes' or importe_centimos <> v_importe);
  select * into v_previo from public.cobros
   where cliente_id = v_usuario and bono_id = p_bono_id and estado = 'creado'
   order by created_at desc limit 1 for update;
  if found then
    update public.cobros set metodo = p_metodo where id = v_previo.id;
    return jsonb_build_object('ok', true, 'cobro_id', v_previo.id, 'pedido', v_previo.pedido_redsys,
                              'importe_centimos', v_previo.importe_centimos, 'reutilizado', true);
  end if;
  if exists (select 1 from public.pagos_pro where pedido_redsys = p_pedido) then
    raise exception 'Pedido repetido.' using errcode = '23505';
  end if;

  insert into public.cobros (
    tipo, bono_id, clase_titulo, cliente_id, entrenador_id, importe_centimos,
    comision_bps, comision_centimos, neto_centimos, metodo, pedido_redsys
  ) values (
    'bono', v_bono.id, 'Bono de ' || v_bono.numero_sesiones || ' sesiones', v_usuario, v_bono.trainer_id, v_importe,
    v_cfg.comision_bonos_bps, v_comision, v_importe - v_comision, p_metodo, p_pedido
  ) returning id into v_id;
  return jsonb_build_object('ok', true, 'cobro_id', v_id, 'pedido', p_pedido, 'importe_centimos', v_importe);
end;
$$;

-- La confirmación de sesiones sigue siendo la de sql/103; los bonos tienen la suya.
do $$
begin
  if to_regprocedure('public.confirmar_cobro_sesion(text, integer, boolean, text, text)') is null then
    alter function public.confirmar_cobro_pagado(text, integer, boolean, text, text) rename to confirmar_cobro_sesion;
  end if;
end;
$$;

create or replace function public.confirmar_cobro_pagado(
  p_pedido text, p_importe_centimos integer, p_autorizado boolean,
  p_codigo_respuesta text default null, p_codigo_autorizacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobro public.cobros%rowtype;
  v_bono  public.bonos%rowtype;
  v_bc    uuid;
begin
  select * into v_cobro from public.cobros where pedido_redsys = p_pedido for update;
  if not found or v_cobro.tipo <> 'bono' then
    return public.confirmar_cobro_sesion(p_pedido, p_importe_centimos, p_autorizado, p_codigo_respuesta, p_codigo_autorizacion);
  end if;
  if v_cobro.estado not in ('creado', 'caducado') then
    return jsonb_build_object('ok', true, 'resultado', 'ya_procesado', 'estado', v_cobro.estado);
  end if;
  if not coalesce(p_autorizado, false) then
    if v_cobro.estado = 'creado' then
      update public.cobros set estado = 'fallido', codigo_respuesta = p_codigo_respuesta where id = v_cobro.id;
    end if;
    return jsonb_build_object('ok', true, 'resultado', 'fallido');
  end if;
  if p_importe_centimos is distinct from v_cobro.importe_centimos then
    return jsonb_build_object('ok', false, 'resultado', 'importe_no_coincide');
  end if;

  select * into v_bono from public.bonos where id = v_cobro.bono_id for update;
  if not found or v_cobro.cliente_id is null
     or not exists (select 1 from public.bonos_a_la_venta(v_bono.trainer_id) x where x = v_bono.id)
     or round(v_bono.precio * 100)::integer <> v_cobro.importe_centimos
     or exists (select 1 from public.bloqueos where bloqueador_id = v_bono.trainer_id and bloqueado_id = v_cobro.cliente_id)
  then
    update public.cobros
       set estado = 'requiere_reembolso', pagado_en = now(),
           codigo_respuesta = p_codigo_respuesta, codigo_autorizacion = p_codigo_autorizacion
     where id = v_cobro.id;
    return jsonb_build_object('ok', true, 'resultado', 'requiere_reembolso');
  end if;

  perform set_config('ruleafit.bono_pagado', '1', true);
  insert into public.bonos_clientes (bono_id, cliente_id, fecha_inicio, fecha_fin, sesiones_total)
  values (v_bono.id, v_cobro.cliente_id, now(),
          case when v_bono.plazo_dias = 0 then timestamptz '9999-12-31 00:00:00+00'
               else now() + make_interval(days => v_bono.plazo_dias) end,
          v_bono.numero_sesiones)
  returning id into v_bc;
  perform set_config('ruleafit.bono_pagado', '', true);

  update public.cobros
     set estado = 'pagado', pagado_en = now(), bono_cliente_id = v_bc,
         codigo_respuesta = p_codigo_respuesta, codigo_autorizacion = p_codigo_autorizacion
   where id = v_cobro.id;
  if v_cobro.neto_centimos > 0 then
    insert into public.bolsas (entrenador_id, pendiente_centimos)
    values (v_cobro.entrenador_id, v_cobro.neto_centimos)
    on conflict (entrenador_id) do update
      set pendiente_centimos = public.bolsas.pendiente_centimos + excluded.pendiente_centimos;
    insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
    values (v_cobro.entrenador_id, v_cobro.id, 'abono_pendiente', 'pendiente', v_cobro.neto_centimos, v_cobro.clase_titulo);
  end if;
  return jsonb_build_object('ok', true, 'resultado', 'pagado', 'bono_cliente_id', v_bc);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Uso y devolución de bonos
--    Usada = sesión que ya ha empezado, o cancelada tarde. Las reservas futuras no cuentan.
-- ----------------------------------------------------------------------------
create or replace function public.bono_usadas(p_bono_cliente uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.reservas r
    left join public.clases c on c.id = r.clase_id
   where r.bono_cliente_id = p_bono_cliente
     and (r.cancelacion_tardia
          or (r.estado = 'activa' and c.estado is distinct from 'cancelada'
              and (c.fecha + c.hora) <= (now() at time zone 'Europe/Madrid')))
$$;

-- Anula una adquisición pagada, libera sus reservas futuras y pide la devolución de la parte no usada. Interna.
create or replace function public.devolver_bono(p_bono_cliente uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bc      public.bonos_clientes%rowtype;
  v_cobro   public.cobros%rowtype;
  v_usadas  integer;
  v_total   integer;
  v_importe integer;
  v_neto    integer;
  r         record;
begin
  select * into v_bc from public.bonos_clientes where id = p_bono_cliente for update;
  if not found or v_bc.anulado_en is not null then
    return jsonb_build_object('ok', true, 'resultado', 'nada');
  end if;
  -- Un bono caducado ya es del organizador.
  if v_bc.fecha_fin < now() then
    return jsonb_build_object('ok', true, 'resultado', 'caducado');
  end if;
  select * into v_cobro from public.cobros where bono_cliente_id = v_bc.id and estado = 'pagado' for update;
  if not found then
    return jsonb_build_object('ok', true, 'resultado', 'sin_pago');
  end if;

  v_total := coalesce(v_bc.sesiones_total, 0);
  v_usadas := least(public.bono_usadas(v_bc.id), v_total);
  if v_total = 0 then
    return jsonb_build_object('ok', true, 'resultado', 'nada');
  end if;

  perform set_config('ruleafit.bono_devolucion', '1', true);
  for r in
    select re.id, re.clase_id
      from public.reservas re join public.clases c on c.id = re.clase_id
     where re.bono_cliente_id = v_bc.id and re.estado = 'activa' and c.estado = 'activa'
       and (c.fecha + c.hora) > (now() at time zone 'Europe/Madrid')
     order by re.clase_id
       for update of re
  loop
    update public.reservas set estado = 'cancelada', cancelled_at = now(), cancelacion_tardia = false where id = r.id;
    update public.clases set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0) where id = r.clase_id;
  end loop;
  perform set_config('ruleafit.bono_devolucion', '', true);

  v_importe := round(v_cobro.importe_centimos::numeric * (v_total - v_usadas) / v_total)::integer;
  if v_importe <= 0 then
    return jsonb_build_object('ok', true, 'resultado', 'sin_parte_no_usada');
  end if;
  v_neto := case when v_importe >= v_cobro.importe_centimos then v_cobro.neto_centimos
                 else round(v_cobro.neto_centimos::numeric * v_importe / v_cobro.importe_centimos)::integer end;

  update public.bonos_clientes
     set anulado_en = now(), anulado_motivo = left(p_motivo, 200), fecha_fin = now()
   where id = v_bc.id;
  update public.cobros
     set estado = 'requiere_reembolso', importe_devolver_centimos = v_importe, neto_devuelto_centimos = v_neto
   where id = v_cobro.id;
  begin
    perform public.generar_notificacion(v_bc.cliente_id, 'sesion_cancelada', 'Devolución de tu bono',
      'Tu bono se ha anulado y te devolveremos ' || to_char(v_importe / 100.0, 'FM999990D00') || ' € por las sesiones no usadas.',
      '/mis-reservas');
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'resultado', 'devolucion_pedida', 'importe_centimos', v_importe, 'usadas', v_usadas);
end;
$$;

-- El alumno pide la devolución (desistimiento).
create or replace function public.cotizar_devolucion_bono(p_bono_cliente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg    public.config_pagos%rowtype;
  v_bc     public.bonos_clientes%rowtype;
  v_cobro  public.cobros%rowtype;
  v_usadas integer;
  v_no     text;
begin
  select * into v_cfg from public.config_pagos where id;
  select * into v_bc from public.bonos_clientes where id = p_bono_cliente;
  select * into v_cobro from public.cobros where bono_cliente_id = p_bono_cliente order by created_at desc limit 1;
  if v_bc.id is null or v_cobro.id is null then
    return jsonb_build_object('puede', false, 'motivo', 'Este bono no se pagó online.');
  end if;
  v_usadas := public.bono_usadas(v_bc.id);
  v_no := case
    when v_bc.anulado_en is not null or v_cobro.estado <> 'pagado' then 'Este bono ya está anulado o devuelto.'
    when v_bc.fecha_fin < now() then 'El bono ha caducado.'
    when (now() at time zone 'Europe/Madrid')::date
         > (v_cobro.pagado_en at time zone 'Europe/Madrid')::date + v_cfg.bono_desistimiento_dias
      then 'Han pasado más de ' || v_cfg.bono_desistimiento_dias || ' días desde la compra.'
    when v_usadas * 100 > coalesce(v_bc.sesiones_total, 0) * v_cfg.bono_desistimiento_uso_max_pct
      then 'Has usado más del ' || v_cfg.bono_desistimiento_uso_max_pct || ' % de las sesiones.'
  end;
  if v_no is not null then
    return jsonb_build_object('puede', false, 'motivo', v_no);
  end if;
  return jsonb_build_object('puede', true, 'usadas', v_usadas,
    'importe_centimos', round(v_cobro.importe_centimos::numeric * (v_bc.sesiones_total - v_usadas) / v_bc.sesiones_total)::integer);
end;
$$;

create or replace function public.solicitar_devolucion_bono(p_bono_cliente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_q       jsonb;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  perform 1 from public.bonos_clientes where id = p_bono_cliente and cliente_id = v_usuario for update;
  if not found then
    raise exception 'El bono no existe.' using errcode = 'P0002';
  end if;
  v_q := public.cotizar_devolucion_bono(p_bono_cliente);
  if not (v_q ->> 'puede')::boolean then
    raise exception '%', v_q ->> 'motivo' using errcode = 'P0001';
  end if;
  return public.devolver_bono(p_bono_cliente, 'Desistimiento del alumno');
end;
$$;

-- El organizador anula un bono vendido, o todos (necesario antes de eliminar su cuenta).
create or replace function public.cancelar_bono_vendido(p_bono_cliente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.bonos_clientes bc join public.bonos b on b.id = bc.bono_id
                  where bc.id = p_bono_cliente and b.trainer_id = v_usuario) then
    raise exception 'El bono no existe.' using errcode = 'P0002';
  end if;
  return public.devolver_bono(p_bono_cliente, 'Anulado por quien organiza');
end;
$$;

create or replace function public.devolver_bonos_de_organizador(p_organizador uuid, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_n integer := 0;
begin
  update public.bonos set activo = false where trainer_id = p_organizador and activo;
  for r in
    select bc.id from public.bonos_clientes bc join public.bonos b on b.id = bc.bono_id
     where b.trainer_id = p_organizador and bc.anulado_en is null
     order by bc.id
  loop
    if public.devolver_bono(r.id, p_motivo) ->> 'resultado' = 'devolucion_pedida' then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$$;

create or replace function public.cancelar_mis_bonos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  return jsonb_build_object('ok', true,
    'devoluciones', public.devolver_bonos_de_organizador(v_usuario, 'Baja de quien organiza'));
end;
$$;

-- Bloqueo: se devuelve la parte no usada (después del trigger de sql/086, por orden alfabético).
create or replace function public.devolver_bonos_por_bloqueo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select bc.id from public.bonos_clientes bc join public.bonos b on b.id = bc.bono_id
     where b.trainer_id = new.bloqueador_id and bc.cliente_id = new.bloqueado_id and bc.anulado_en is null
  loop
    begin
      perform public.devolver_bono(r.id, 'Bloqueo');
    exception when others then
      perform public.registrar_alerta('devoluciones', 'bonos:bloqueo:' || r.id, 'critica',
        'No se ha podido devolver un bono tras un bloqueo: ' || sqlerrm);
    end;
  end loop;
  return null;
end;
$$;
drop trigger if exists trg_devolver_bonos_por_bloqueo on public.bloqueos;
create trigger trg_devolver_bonos_por_bloqueo after insert on public.bloqueos
  for each row execute function public.devolver_bonos_por_bloqueo();

-- Cancelaciones reiteradas: retiene el saldo de bonos y avisa. Un fallo aquí nunca rompe una cancelación.
create or replace function public.contar_cancelacion_con_bono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer uuid;
  v_cfg     public.config_pagos%rowtype;
  v_n       integer;
begin
  begin
    if coalesce(current_setting('ruleafit.bono_devolucion', true), '') = '1' then return null; end if;
    select trainer_id into v_trainer from public.clases where id = new.clase_id;
    if v_trainer is null or auth.uid() is distinct from v_trainer then return null; end if;
    if exists (select 1 from public.bloqueos where bloqueador_id = v_trainer and bloqueado_id = new.cliente_id) then return null; end if;
    if not exists (select 1 from public.cobros where bono_cliente_id = new.bono_cliente_id) then return null; end if;
    insert into public.bonos_cancelaciones (organizador_id, clase_id) values (v_trainer, new.clase_id)
    on conflict do nothing;
    select * into v_cfg from public.config_pagos where id;
    select count(*) into v_n from public.bonos_cancelaciones
     where organizador_id = v_trainer
       and created_at > greatest(
             now() - make_interval(days => v_cfg.bono_cancelaciones_dias),
             coalesce((select max(levantada_en) from public.bonos_retenciones where organizador_id = v_trainer), '-infinity'));
    if v_n >= v_cfg.bono_cancelaciones_limite then
      insert into public.bonos_retenciones (organizador_id, motivo)
      values (v_trainer, v_n || ' sesiones con alumnos de bono canceladas en ' || v_cfg.bono_cancelaciones_dias || ' días')
      on conflict (organizador_id) where levantada_en is null do nothing;
      perform public.registrar_alerta('liquidaciones', 'bonos:retencion:' || v_trainer, 'critica',
        'Saldo de bonos retenido por cancelaciones reiteradas del organizador ' || v_trainer || '. Revisar en /admin/alertas.');
    end if;
  exception when others then
    raise warning 'contar_cancelacion_con_bono: %', sqlerrm;
  end;
  return null;
end;
$$;
drop trigger if exists trg_contar_cancelacion_con_bono on public.reservas;
create trigger trg_contar_cancelacion_con_bono
  after update of estado on public.reservas
  for each row
  when (old.estado = 'activa' and new.estado = 'cancelada' and new.bono_cliente_id is not null)
  execute function public.contar_cancelacion_con_bono();

create or replace function public.levantar_retencion_bonos(p_organizador uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bonos_retenciones set levantada_en = now() where organizador_id = p_organizador and levantada_en is null;
  perform public.resolver_alerta_clave('bonos:retencion:' || p_organizador);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Bolsa: retención, liberación, devoluciones
-- ----------------------------------------------------------------------------
create or replace function public.cobro_retenido(p_cobro_id uuid, p_reserva_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.incidencias_pago i
     where i.estado in ('abierta', 'en_revision')
       and (i.cobro_id = p_cobro_id or i.reserva_id = p_reserva_id)
  ) or exists (
    select 1 from public.cobros c join public.bonos_retenciones r on r.organizador_id = c.entrenador_id
     where c.id = p_cobro_id and c.tipo = 'bono' and r.levantada_en is null
  )
$$;

-- Como sql/105, contando lo que quede tras una devolución parcial. Los bonos se liberan 48 h después de la compra
-- (no tienen sesión).
create or replace function public.liberar_pendientes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horas integer;
  v_cobro record;
  v_monto integer;
  v_total integer := 0;
begin
  select horas_liberacion into v_horas from public.config_pagos where id;
  if v_horas is null then
    return 0;
  end if;
  for v_cobro in
    select c.id, c.entrenador_id, c.neto_centimos, c.neto_devuelto_centimos, c.estado
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.estado in ('pagado', 'reembolsado_parcial')
       and c.liberado_en is null
       and not public.cobro_retenido(c.id, c.reserva_id)
       and coalesce(cl.estado, 'activa') <> 'cancelada'
       and (
         case when cl.id is not null
              then ((cl.fecha::text || ' ' || cl.hora::text)::timestamp
                    + make_interval(mins => coalesce(cl.duracion, 60))) at time zone 'Europe/Madrid'
              else c.pagado_en
         end
       ) + make_interval(hours => v_horas) <= now()
     order by c.pagado_en
       for update of c skip locked
  loop
    v_monto := v_cobro.neto_centimos
               - case when v_cobro.estado = 'reembolsado_parcial' then coalesce(v_cobro.neto_devuelto_centimos, 0) else 0 end;
    if v_monto > 0 then
      insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
      values (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'pendiente', -v_monto, 'Liberación'),
             (v_cobro.entrenador_id, v_cobro.id, 'liberacion', 'disponible', v_monto, 'Liberación');
      update public.bolsas
         set pendiente_centimos = pendiente_centimos - v_monto,
             disponible_centimos = disponible_centimos + v_monto
       where entrenador_id = v_cobro.entrenador_id;
    end if;
    update public.cobros set liberado_en = now() where id = v_cobro.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

do $$
begin
  if to_regprocedure('public.reclamar_devolucion_cobro()') is null then
    alter function public.reclamar_devolucion() rename to reclamar_devolucion_cobro;
  end if;
  if to_regprocedure('public.completar_devolucion_cobro(uuid, boolean, text, text)') is null then
    alter function public.completar_devolucion(uuid, boolean, text, text) rename to completar_devolucion_cobro;
  end if;
end;
$$;

-- Primero las de alumnos (con el importe parcial si lo hay); después las de la suscripción Pro.
create or replace function public.reclamar_devolucion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res     jsonb := public.reclamar_devolucion_cobro();
  v_parcial integer;
  v_pago    public.pagos_pro%rowtype;
begin
  if v_res ->> 'resultado' = 'reclamada' then
    select importe_devolver_centimos into v_parcial from public.cobros where id = (v_res ->> 'cobro_id')::uuid;
    if v_parcial is not null then
      update public.devoluciones set importe_centimos = v_parcial where cobro_id = (v_res ->> 'cobro_id')::uuid;
      v_res := v_res || jsonb_build_object('importe_centimos', v_parcial);
    end if;
    return v_res;
  end if;
  select * into v_pago from public.pagos_pro
   where estado = 'requiere_reembolso'
     and (devolucion_estado is null or (devolucion_estado = 'fallida' and devolucion_intentos < 5))
   order by updated_at limit 1 for update skip locked;
  if not found then
    return v_res;
  end if;
  update public.pagos_pro
     set devolucion_estado = 'en_curso', devolucion_intentos = devolucion_intentos + 1, updated_at = now()
   where id = v_pago.id;
  return jsonb_build_object('ok', true, 'resultado', 'reclamada', 'cobro_id', v_pago.id, 'pedido', v_pago.pedido_redsys,
    'importe_centimos', coalesce(v_pago.importe_devolver_centimos, v_pago.importe_centimos));
end;
$$;

create or replace function public.completar_devolucion(
  p_cobro_id uuid, p_confirmada boolean, p_codigo_respuesta text default null, p_detalle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago  public.pagos_pro%rowtype;
  v_cobro public.cobros%rowtype;
  v_dev   public.devoluciones%rowtype;
  v_bolsa text;
begin
  select * into v_pago from public.pagos_pro where id = p_cobro_id for update;
  if found then
    if v_pago.devolucion_estado = 'completada' then
      return jsonb_build_object('ok', true, 'resultado', 'ya_procesado');
    end if;
    if v_pago.devolucion_estado is null then
      return jsonb_build_object('ok', false, 'resultado', 'sin_devolucion');
    end if;
    update public.pagos_pro
       set devolucion_estado = case when coalesce(p_confirmada, false) then 'completada' else 'fallida' end,
           estado = case when not coalesce(p_confirmada, false) then estado
                         when coalesce(importe_devolver_centimos, importe_centimos) < importe_centimos then 'reembolsado_parcial'
                         else 'reembolsado' end,
           updated_at = now()
     where id = v_pago.id;
    return jsonb_build_object('ok', true, 'resultado', case when coalesce(p_confirmada, false) then 'completada' else 'fallida' end);
  end if;

  select * into v_cobro from public.cobros where id = p_cobro_id for update;
  if not found or not coalesce(p_confirmada, false)
     or coalesce(v_cobro.importe_devolver_centimos, v_cobro.importe_centimos) >= v_cobro.importe_centimos then
    return public.completar_devolucion_cobro(p_cobro_id, p_confirmada, p_codigo_respuesta, p_detalle);
  end if;

  -- Devolución parcial confirmada.
  select * into v_dev from public.devoluciones where cobro_id = p_cobro_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'resultado', 'sin_devolucion');
  end if;
  if v_dev.estado = 'completada' then
    return jsonb_build_object('ok', true, 'resultado', 'ya_procesado');
  end if;
  update public.cobros set estado = 'reembolsado_parcial' where id = p_cobro_id;
  update public.devoluciones
     set estado = 'completada', codigo_respuesta = p_codigo_respuesta, ultimo_error = null, completada_en = now()
   where cobro_id = p_cobro_id;
  if coalesce(v_cobro.neto_devuelto_centimos, 0) > 0
     and exists (select 1 from public.movimientos_bolsa where cobro_id = p_cobro_id and tipo = 'abono_pendiente') then
    v_bolsa := case when v_cobro.liberado_en is null then 'pendiente' else 'disponible' end;
    update public.bolsas
       set pendiente_centimos  = case when v_bolsa = 'pendiente' then pendiente_centimos - v_cobro.neto_devuelto_centimos else pendiente_centimos end,
           disponible_centimos = case when v_bolsa = 'disponible' then disponible_centimos - v_cobro.neto_devuelto_centimos else disponible_centimos end
     where entrenador_id = v_cobro.entrenador_id;
    insert into public.movimientos_bolsa (entrenador_id, cobro_id, tipo, bolsa, importe_centimos, nota)
    values (v_cobro.entrenador_id, p_cobro_id, 'reembolso', v_bolsa, -v_cobro.neto_devuelto_centimos, 'Devolución parcial al alumno');
  end if;
  return jsonb_build_object('ok', true, 'resultado', 'completada');
end;
$$;

create or replace function public.mis_ingresos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_horas   integer;
  v_bolsa   record;
  v_res     jsonb;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select horas_liberacion into v_horas from public.config_pagos where id;
  select coalesce(sum(pendiente_centimos), 0) as pendiente, coalesce(sum(disponible_centimos), 0) as disponible
    into v_bolsa from public.bolsas where entrenador_id = v_usuario;

  with mios as (
    select c.id, c.estado, c.tipo, c.importe_centimos, c.comision_centimos, c.neto_centimos, c.pagado_en, c.liberado_en,
           coalesce(c.neto_devuelto_centimos, 0) as neto_devuelto,
           coalesce(cl.titulo, c.clase_titulo, 'Sesión') as titulo, cl.fecha, cl.hora,
           case when cl.id is not null
                then ((cl.fecha::text || ' ' || cl.hora::text)::timestamp + make_interval(mins => coalesce(cl.duracion, 60)))
                       at time zone 'Europe/Madrid'
                else c.pagado_en
           end + make_interval(hours => v_horas) as libera_desde,
           public.cobro_retenido(c.id, c.reserva_id) as retenido
      from public.cobros c
      left join public.clases cl on cl.id = c.clase_id
     where c.entrenador_id = v_usuario
       and exists (select 1 from public.movimientos_bolsa m where m.cobro_id = c.id and m.tipo = 'abono_pendiente')
  ), clasificados as (
    select *,
           case when estado = 'reembolsado' then 'devuelto'
                when estado = 'requiere_reembolso' then 'en_devolucion'
                when retenido then 'retenido'
                when liberado_en is not null then 'disponible'
                else 'pendiente'
           end as situacion,
           -- Lo que sigue siendo del organizador (o está en juego) de cada cobro.
           case when estado = 'reembolsado_parcial' then neto_centimos - neto_devuelto else neto_centimos end as neto_vivo,
           case when estado = 'requiere_reembolso' and neto_devuelto > 0 then neto_devuelto else neto_centimos end as neto_en_juego
      from mios
  )
  select jsonb_build_object(
    'horas_liberacion', v_horas,
    'pendiente_centimos', v_bolsa.pendiente
       - coalesce(sum(case when situacion = 'retenido' then neto_vivo else neto_en_juego end)
                  filter (where situacion in ('retenido', 'en_devolucion') and liberado_en is null), 0),
    'disponible_centimos', v_bolsa.disponible
       - coalesce(sum(case when situacion = 'retenido' then neto_vivo else neto_en_juego end)
                  filter (where situacion in ('retenido', 'en_devolucion') and liberado_en is not null), 0),
    'retenido_centimos', coalesce(sum(neto_vivo) filter (where situacion = 'retenido'), 0),
    'en_devolucion_centimos', coalesce(sum(neto_en_juego) filter (where situacion = 'en_devolucion'), 0),
    'liquidado_centimos', (select coalesce(sum(importe_centimos), 0) from public.liquidaciones_lineas
                            where entrenador_id = v_usuario and estado = 'pagada'),
    'total_cobros', count(*),
    'cobros', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.pagado_en desc)
        from (select id, titulo, fecha, hora, pagado_en, importe_centimos, comision_centimos,
                     neto_vivo as neto_centimos, situacion, libera_desde, tipo
                from clasificados order by pagado_en desc limit 200) x), '[]'::jsonb),
    'liquidaciones', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', l.fecha_pago, 'importe_centimos', ll.importe_centimos,
                                          'estado', ll.estado, 'iban_ultimos4', ll.iban_ultimos4)
                       order by l.fecha_pago desc)
        from public.liquidaciones_lineas ll join public.liquidaciones l on l.id = ll.liquidacion_id
       where ll.entrenador_id = v_usuario), '[]'::jsonb)
  ) into v_res
  from clasificados;
  return v_res;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7) Reclamaciones: además de pagos sin plaza (sql/103), cualquier bono pagado.
-- ----------------------------------------------------------------------------
create or replace function public.abrir_incidencia_cobro(p_cobro_id uuid, p_tipo text, p_descripcion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_cobro   record;
  v_texto   text := btrim(coalesce(p_descripcion, ''));
  v_numero  text;
  v_id      uuid;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  if p_tipo is null or p_tipo not in ('cobro', 'cancelacion', 'reembolso') then
    raise exception 'Motivo no válido.' using errcode = 'P0001';
  end if;
  if char_length(v_texto) < 10 or char_length(v_texto) > 1000 then
    raise exception 'Explica lo ocurrido con entre 10 y 1000 caracteres.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('incidencia:' || v_usuario::text));

  select co.id, co.clase_titulo, c.fecha into v_cobro
    from public.cobros co
    left join public.clases c on c.id = co.clase_id
   where co.id = p_cobro_id and co.cliente_id = v_usuario and co.reserva_id is null
     and (co.estado in ('requiere_reembolso', 'reembolsado')
          or (co.tipo = 'bono' and co.estado in ('pagado', 'reembolsado_parcial')));
  if not found then
    raise exception 'El pago no existe.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.incidencias_pago
              where cobro_id = p_cobro_id and tipo = p_tipo and estado in ('abierta', 'en_revision')) then
    raise exception 'Ya tienes un caso abierto por este motivo para este pago.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.incidencias_pago
       where usuario_id = v_usuario and estado in ('abierta', 'en_revision')) >= 10
     or (select count(*) from public.incidencias_pago
          where usuario_id = v_usuario and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Has abierto muchos casos seguidos. Espera a que revisemos los anteriores.' using errcode = 'P0001';
  end if;

  v_numero := 'RF-' || to_char(now() at time zone 'Europe/Madrid', 'YYYY') || '-'
              || lpad(nextval('public.incidencias_pago_numero_seq')::text, 6, '0');
  insert into public.incidencias_pago (numero, usuario_id, cobro_id, clase_titulo, clase_fecha, tipo, descripcion)
  values (v_numero, v_usuario, p_cobro_id, coalesce(v_cobro.clase_titulo, 'Sesión'), v_cobro.fecha, p_tipo, v_texto)
  returning id into v_id;
  insert into public.incidencias_pago_eventos (incidencia_id, estado) values (v_id, 'abierta');
  begin
    perform public.generar_notificacion(v_usuario, 'incidencia_pago', 'Hemos recibido tu reclamación',
      'Caso ' || v_numero || ': lo revisaremos y verás aquí su estado.', '/mis-reservas?pestana=reclamaciones');
  exception when others then null; end;
  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_numero);
end;
$$;

-- «Devolver y cerrar» sobre un bono devuelve la parte no usada.
do $$
begin
  if to_regprocedure('public.devolver_y_cerrar_sesion(uuid, text)') is null then
    alter function public.devolver_y_cerrar_incidencia(uuid, text) rename to devolver_y_cerrar_sesion;
  end if;
end;
$$;

create or replace function public.devolver_y_cerrar_incidencia(p_id uuid, p_respuesta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caso  public.incidencias_pago%rowtype;
  v_cobro public.cobros%rowtype;
  v_res   jsonb;
begin
  select * into v_caso from public.incidencias_pago where id = p_id for update;
  select * into v_cobro from public.cobros where id = v_caso.cobro_id and tipo = 'bono';
  if v_cobro.id is null or v_cobro.estado = 'requiere_reembolso' then
    return public.devolver_y_cerrar_sesion(p_id, p_respuesta);
  end if;
  if nullif(btrim(coalesce(p_respuesta, '')), '') is null then
    raise exception 'Para cerrar un caso hay que escribir una respuesta.' using errcode = 'P0001';
  end if;
  if v_caso.estado not in ('abierta', 'en_revision') then
    raise exception 'El caso ya está cerrado.' using errcode = 'P0001';
  end if;
  v_res := public.devolver_bono(v_cobro.bono_cliente_id, 'Reclamación ' || v_caso.numero);
  if v_res ->> 'resultado' is distinct from 'devolucion_pedida' then
    raise exception 'Este bono no tiene parte sin usar que devolver (caducado, agotado o ya anulado). Cierra el caso sin más.' using errcode = 'P0001';
  end if;
  perform public.actualizar_incidencia(p_id, 'resuelta', p_respuesta);
  return jsonb_build_object('ok', true, 'cobro_id', v_cobro.id, 'reserva_cancelada', false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) Plan Pro
-- ----------------------------------------------------------------------------
create or replace function public.crear_pago_pro(p_pedido text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_cfg     public.config_pagos%rowtype;
  v_previo  public.pagos_pro%rowtype;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select * into v_cfg from public.config_pagos where id;
  if not found or not v_cfg.pagos_activos then
    raise exception 'Los pagos online no están activados todavía.' using errcode = 'P0001';
  end if;
  if v_cfg.parada_cobros then
    raise exception 'Los pagos online están en pausa temporalmente. No se te ha cobrado nada. Inténtalo más tarde.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfiles_fiscales where usuario_id = v_usuario and estado = 'activo') then
    raise exception 'Antes de contratar Pro necesitas tus datos fiscales aprobados (Mi cuenta → Datos fiscales y cobros).' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('pro:' || v_usuario::text));
  if public.pro_activo(v_usuario) then
    raise exception 'Ya tienes Pro activo. Si cancelaste la renovación, puedes reactivarla.' using errcode = 'P0001';
  end if;
  update public.pagos_pro set estado = 'caducado', updated_at = now()
   where usuario_id = v_usuario and estado = 'creado' and created_at <= now() - interval '30 minutes';
  select * into v_previo from public.pagos_pro
   where usuario_id = v_usuario and estado = 'creado' and tipo = 'alta' and importe_centimos = v_cfg.pro_precio_centimos
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'pedido', v_previo.pedido_redsys, 'importe_centimos', v_previo.importe_centimos);
  end if;
  if exists (select 1 from public.cobros where pedido_redsys = p_pedido) then
    raise exception 'Pedido repetido.' using errcode = '23505';
  end if;
  insert into public.pagos_pro (usuario_id, tipo, pedido_redsys, importe_centimos)
  values (v_usuario, 'alta', p_pedido, v_cfg.pro_precio_centimos);
  return jsonb_build_object('ok', true, 'pedido', p_pedido, 'importe_centimos', v_cfg.pro_precio_centimos);
end;
$$;

-- La llama el aviso del banco (ya verificado) o el cobro periódico. Idempotente.
create or replace function public.confirmar_pago_pro(
  p_pedido text, p_importe_centimos integer, p_autorizado boolean, p_codigo_respuesta text default null,
  p_identificador text default null, p_cof_txnid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago   public.pagos_pro%rowtype;
  v_sus    public.suscripciones_pro%rowtype;
  v_inicio timestamptz;
begin
  select * into v_pago from public.pagos_pro where pedido_redsys = p_pedido for update;
  if not found then
    return jsonb_build_object('ok', false, 'resultado', 'desconocido');
  end if;
  if v_pago.estado not in ('creado', 'caducado', 'dudoso') then
    return jsonb_build_object('ok', true, 'resultado', 'ya_procesado', 'estado', v_pago.estado);
  end if;
  perform pg_advisory_xact_lock(hashtext('pro:' || v_pago.usuario_id::text));
  select * into v_sus from public.suscripciones_pro where usuario_id = v_pago.usuario_id for update;

  if not coalesce(p_autorizado, false) then
    update public.pagos_pro set estado = 'fallido', codigo_respuesta = p_codigo_respuesta, updated_at = now() where id = v_pago.id;
    if v_pago.tipo = 'renovacion' then
      update public.suscripciones_pro set estado = 'impagada', updated_at = now()
       where usuario_id = v_pago.usuario_id and estado = 'activa';
    end if;
    return jsonb_build_object('ok', true, 'resultado', 'fallido');
  end if;
  if p_importe_centimos is distinct from v_pago.importe_centimos then
    return jsonb_build_object('ok', false, 'resultado', 'importe_no_coincide');
  end if;

  -- Cobro que ya no corresponde (alta repetida, o renovación tras cancelar): se devuelve entero.
  if (v_pago.tipo = 'alta' and public.pro_activo(v_pago.usuario_id))
     or (v_pago.tipo = 'renovacion' and (v_sus.usuario_id is null or v_sus.cancelada_en is not null))
     or not exists (select 1 from auth.users where id = v_pago.usuario_id) then
    update public.pagos_pro
       set estado = 'requiere_reembolso', pagado_en = now(), codigo_respuesta = p_codigo_respuesta, updated_at = now()
     where id = v_pago.id;
    return jsonb_build_object('ok', true, 'resultado', 'requiere_reembolso');
  end if;

  if v_pago.tipo = 'alta' then
    v_inicio := now();
    insert into public.suscripciones_pro as s (
      usuario_id, estado, renovacion, periodo_inicio, periodo_fin, primer_alta_en, identificador_tarjeta, cof_txnid
    ) values (
      v_pago.usuario_id, 'activa', p_identificador is not null, v_inicio, v_inicio + interval '1 month', v_inicio,
      p_identificador, p_cof_txnid
    )
    on conflict (usuario_id) do update
      set estado = 'activa', renovacion = excluded.renovacion, periodo_inicio = excluded.periodo_inicio,
          periodo_fin = excluded.periodo_fin, cancelada_en = null, ultimo_intento_en = null,
          identificador_tarjeta = excluded.identificador_tarjeta, cof_txnid = excluded.cof_txnid, updated_at = now();
  else
    v_inicio := v_sus.periodo_fin;
    update public.suscripciones_pro
       set estado = 'activa', periodo_inicio = v_inicio, periodo_fin = v_inicio + interval '1 month',
           ultimo_intento_en = null, updated_at = now()
     where usuario_id = v_pago.usuario_id;
  end if;
  update public.pagos_pro
     set estado = 'pagado', pagado_en = now(), codigo_respuesta = p_codigo_respuesta,
         periodo_inicio = v_inicio, periodo_fin = v_inicio + interval '1 month', updated_at = now()
   where id = v_pago.id;
  return jsonb_build_object('ok', true, 'resultado', 'pagado');
end;
$$;

create or replace function public.cancelar_pro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  update public.suscripciones_pro
     set renovacion = false, cancelada_en = coalesce(cancelada_en, now()), updated_at = now()
   where usuario_id = auth.uid() and estado <> 'caducada'
  returning periodo_fin into v_fin;
  if v_fin is null then
    raise exception 'No tienes una suscripción activa.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'activa_hasta', v_fin);
end;
$$;

create or replace function public.reactivar_pro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  update public.suscripciones_pro set renovacion = true, cancelada_en = null, updated_at = now()
   where usuario_id = auth.uid() and estado <> 'caducada' and periodo_fin > now() and identificador_tarjeta is not null;
  if not found then
    raise exception 'No se puede reactivar: contrata Pro de nuevo.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Desistimiento dentro del plazo desde el primer alta: íntegro si no vendió bonos; si vendió, los días no disfrutados.
create or replace function public.cotizar_desistimiento_pro(p_usuario uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg     public.config_pagos%rowtype;
  v_sus     public.suscripciones_pro%rowtype;
  v_pago    public.pagos_pro%rowtype;
  v_vendio  boolean;
  v_importe integer;
begin
  select * into v_cfg from public.config_pagos where id;
  select * into v_sus from public.suscripciones_pro where usuario_id = p_usuario and estado <> 'caducada';
  if v_sus.usuario_id is null
     or (now() at time zone 'Europe/Madrid')::date
        > (v_sus.primer_alta_en at time zone 'Europe/Madrid')::date + v_cfg.pro_desistimiento_dias then
    return jsonb_build_object('puede', false);
  end if;
  select * into v_pago from public.pagos_pro
   where usuario_id = p_usuario and tipo = 'alta' and estado = 'pagado' and pagado_en >= v_sus.primer_alta_en
   order by pagado_en limit 1;
  if v_pago.id is null then
    return jsonb_build_object('puede', false);
  end if;
  v_vendio := exists (select 1 from public.cobros
                       where entrenador_id = p_usuario and tipo = 'bono' and pagado_en >= v_sus.primer_alta_en);
  v_importe := case when not v_vendio then v_pago.importe_centimos
    else round(v_pago.importe_centimos
               * greatest(extract(epoch from v_pago.periodo_fin - now()), 0)
               / extract(epoch from v_pago.periodo_fin - v_pago.periodo_inicio))::integer end;
  return jsonb_build_object('puede', v_importe > 0, 'importe_centimos', v_importe, 'integro', not v_vendio, 'pago_id', v_pago.id);
end;
$$;

create or replace function public.desistir_pro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_q       jsonb;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext('pro:' || v_usuario::text));
  v_q := public.cotizar_desistimiento_pro(v_usuario);
  if not (v_q ->> 'puede')::boolean then
    raise exception 'Ya no estás en plazo de desistimiento. Puedes cancelar la renovación.' using errcode = 'P0001';
  end if;
  update public.pagos_pro
     set estado = 'requiere_reembolso', importe_devolver_centimos = (v_q ->> 'importe_centimos')::integer, updated_at = now()
   where id = (v_q ->> 'pago_id')::uuid;
  update public.suscripciones_pro
     set estado = 'caducada', renovacion = false, cancelada_en = now(), periodo_fin = now(),
         identificador_tarjeta = null, cof_txnid = null, updated_at = now()
   where usuario_id = v_usuario;
  return jsonb_build_object('ok', true, 'importe_centimos', (v_q ->> 'importe_centimos')::integer);
end;
$$;

-- Cobro periódico (solo servicio). Caduca lo vencido y entrega UNA renovación pendiente.
create or replace function public.reclamar_renovacion_pro(p_pedido text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.config_pagos%rowtype;
  v_sus public.suscripciones_pro%rowtype;
  r     record;
begin
  select * into v_cfg from public.config_pagos where id;
  update public.suscripciones_pro
     set estado = 'caducada', renovacion = false, identificador_tarjeta = null, cof_txnid = null, updated_at = now()
   where estado <> 'caducada'
     and now() >= periodo_fin + make_interval(days => case when renovacion then v_cfg.pro_gracia_dias else 0 end);
  update public.pagos_pro set estado = 'caducado', updated_at = now()
   where tipo = 'alta' and estado = 'creado' and created_at <= now() - interval '30 minutes';
  -- Un cobro periódico sin respuesta no se repite a ciegas.
  for r in
    update public.pagos_pro set estado = 'dudoso', updated_at = now()
     where tipo = 'renovacion' and estado = 'creado' and created_at <= now() - interval '30 minutes'
    returning id
  loop
    perform public.registrar_alerta('webhook', 'pro:renovacion_dudosa:' || r.id, 'critica',
      'Cobro de renovación Pro sin respuesta del banco: revisar antes de reintentar. Pago ' || r.id);
  end loop;
  if not v_cfg.pagos_activos or v_cfg.parada_cobros then
    return jsonb_build_object('ok', true, 'resultado', 'parado');
  end if;
  select s.* into v_sus from public.suscripciones_pro s
   where s.renovacion and s.estado <> 'caducada' and s.periodo_fin <= now() and s.identificador_tarjeta is not null
     and (s.ultimo_intento_en is null or s.ultimo_intento_en <= now() - interval '23 hours')
     and not exists (select 1 from public.pagos_pro p
                      where p.usuario_id = s.usuario_id and p.tipo = 'renovacion' and p.estado in ('creado', 'dudoso'))
   order by s.periodo_fin limit 1 for update skip locked;
  if not found then
    return jsonb_build_object('ok', true, 'resultado', 'nada_pendiente');
  end if;
  insert into public.pagos_pro (usuario_id, tipo, pedido_redsys, importe_centimos)
  values (v_sus.usuario_id, 'renovacion', p_pedido, v_cfg.pro_precio_centimos);
  update public.suscripciones_pro set ultimo_intento_en = now(), updated_at = now() where usuario_id = v_sus.usuario_id;
  return jsonb_build_object('ok', true, 'resultado', 'reclamada', 'pedido', p_pedido,
    'importe_centimos', v_cfg.pro_precio_centimos, 'identificador', v_sus.identificador_tarjeta, 'cof_txnid', v_sus.cof_txnid);
end;
$$;

create or replace function public.marcar_pago_pro_dudoso(p_pedido text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pagos_pro set estado = 'dudoso', updated_at = now() where pedido_redsys = p_pedido and estado = 'creado'
$$;

-- ----------------------------------------------------------------------------
-- 9) Lecturas para la web
-- ----------------------------------------------------------------------------
create or replace function public.mi_pro()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_cfg     public.config_pagos%rowtype;
  v_sus     public.suscripciones_pro%rowtype;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;
  select * into v_cfg from public.config_pagos where id;
  select * into v_sus from public.suscripciones_pro where usuario_id = v_usuario;
  return jsonb_build_object(
    'precio_centimos', v_cfg.pro_precio_centimos,
    'gracia_dias', v_cfg.pro_gracia_dias,
    'activa', public.pro_activo(v_usuario),
    'estado', v_sus.estado,
    'renovacion', coalesce(v_sus.renovacion, false),
    'periodo_fin', v_sus.periodo_fin,
    'puede_reactivar', coalesce(not v_sus.renovacion and v_sus.estado <> 'caducada' and v_sus.periodo_fin > now()
                                and v_sus.identificador_tarjeta is not null, false),
    'desistimiento', public.cotizar_desistimiento_pro(v_usuario) - 'pago_id',
    'fiscal_activo', exists (select 1 from public.perfiles_fiscales where usuario_id = v_usuario and estado = 'activo'),
    'pagos', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
       from (select id, tipo, estado, importe_centimos, importe_devolver_centimos, periodo_inicio, periodo_fin, created_at
               from public.pagos_pro where usuario_id = v_usuario and estado not in ('creado', 'caducado')
              order by created_at desc limit 24) x), '[]'::jsonb));
end;
$$;

-- Bonos comprados por quien consulta: estado y devolución posible.
create or replace function public.mis_bonos_estado()
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
    select jsonb_object_agg(bc.id, jsonb_build_object(
             'anulado', bc.anulado_en is not null,
             'sin_caducidad', bc.fecha_fin >= timestamptz '9000-01-01 00:00:00+00',
             'cobro_id', co.id, 'estado_cobro', co.estado,
             'importe_devolver_centimos', coalesce(co.importe_devolver_centimos,
                case when co.estado in ('requiere_reembolso', 'reembolsado') then co.importe_centimos end),
             'devolucion', public.cotizar_devolucion_bono(bc.id)))
      from public.bonos_clientes bc
      left join lateral (select * from public.cobros c where c.bono_cliente_id = bc.id order by c.created_at desc limit 1) co on true
     where bc.cliente_id = auth.uid()), '{}'::jsonb);
end;
$$;

-- Bonos vendidos por quien consulta (para poder anularlos).
create or replace function public.mis_bonos_vendidos_estado()
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
    select jsonb_object_agg(bc.id, jsonb_build_object(
             'anulado', bc.anulado_en is not null,
             'sin_caducidad', bc.fecha_fin >= timestamptz '9000-01-01 00:00:00+00',
             'anulable', bc.anulado_en is null and bc.fecha_fin >= now() and co.estado = 'pagado'
                         and (public.bono_usadas(bc.id) < coalesce(bc.sesiones_total, 0))))
      from public.bonos_clientes bc
      join public.bonos b on b.id = bc.bono_id
      left join lateral (select * from public.cobros c where c.bono_cliente_id = bc.id order by c.created_at desc limit 1) co on true
     where b.trainer_id = auth.uid()), '{}'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 10) Eliminar cuenta
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.eliminar_mi_cuenta_base()') is null then
    alter function public.eliminar_mi_cuenta() rename to eliminar_mi_cuenta_base;
  end if;
end;
$$;

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is not null then
    if exists (
      select 1 from public.bonos_clientes bc
        join public.bonos b on b.id = bc.bono_id
       where b.trainer_id = v_usuario and bc.anulado_en is null and bc.fecha_fin >= now()
         and exists (select 1 from public.cobros c where c.bono_cliente_id = bc.id and c.estado = 'pagado')
         and (public.bono_usadas(bc.id) < coalesce(bc.sesiones_total, 0)
              or exists (select 1 from public.reservas r join public.clases cl on cl.id = r.clase_id
                          where r.bono_cliente_id = bc.id and r.estado = 'activa' and cl.estado = 'activa'
                            and (cl.fecha + cl.hora) > (now() at time zone 'Europe/Madrid')))
    ) then
      raise exception 'Tienes bonos vendidos con sesiones pendientes. En Mis sesiones → Bonos, pulsa «Cancelar mis bonos y devolver lo no usado».'
        using errcode = 'P0001';
    end if;
    if exists (select 1 from public.pagos_pro where usuario_id = v_usuario and estado in ('requiere_reembolso', 'dudoso')) then
      raise exception 'Tienes un pago de la suscripción Pro pendiente de resolver. Escríbenos desde Ayuda.' using errcode = 'P0001';
    end if;
    -- Se deja de cobrar y se borra la referencia de la tarjeta. Si la cuenta no se elimina, todo se deshace.
    delete from public.suscripciones_pro where usuario_id = v_usuario;
  end if;
  perform public.eliminar_mi_cuenta_base();
end;
$$;

-- ----------------------------------------------------------------------------
-- 11) Permisos
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  -- Solo el servicio (o llamadas internas).
  foreach f in array array[
    'pro_activo(uuid)', 'puede_vender_bonos(uuid)', 'bono_usadas(uuid)', 'devolver_bono(uuid, text)',
    'cotizar_devolucion_bono(uuid)', 'cotizar_desistimiento_pro(uuid)', 'devolver_bonos_de_organizador(uuid, text)',
    'levantar_retencion_bonos(uuid)', 'cobro_retenido(uuid, uuid)', 'liberar_pendientes()',
    'confirmar_cobro_sesion(text, integer, boolean, text, text)',
    'confirmar_cobro_pagado(text, integer, boolean, text, text)',
    'confirmar_pago_pro(text, integer, boolean, text, text, text)',
    'reclamar_renovacion_pro(text)', 'marcar_pago_pro_dudoso(text)',
    'reclamar_devolucion()', 'reclamar_devolucion_cobro()',
    'completar_devolucion(uuid, boolean, text, text)', 'completar_devolucion_cobro(uuid, boolean, text, text)',
    'devolver_y_cerrar_incidencia(uuid, text)', 'devolver_y_cerrar_sesion(uuid, text)',
    'eliminar_mi_cuenta_base()', 'validar_bono()', 'impedir_bono_sin_pago()', 'devolver_bonos_por_bloqueo()',
    'contar_cancelacion_con_bono()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- Personas con sesión iniciada (cada función comprueba quién es).
  foreach f in array array[
    'bonos_a_la_venta(uuid)', 'crear_cobro_bono(uuid, text, text)', 'solicitar_devolucion_bono(uuid)',
    'cancelar_bono_vendido(uuid)', 'cancelar_mis_bonos()', 'crear_pago_pro(text)', 'cancelar_pro()', 'reactivar_pro()',
    'desistir_pro()', 'mi_pro()', 'mis_bonos_estado()', 'mis_bonos_vendidos_estado()', 'mis_ingresos()',
    'abrir_incidencia_cobro(uuid, text, text)', 'eliminar_mi_cuenta()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
