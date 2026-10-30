-- ============================================================================
-- Ruleafit · 071_pagos_tablas.sql
-- Fase 1 de pagos (ver docs/plan-pagos-fase-1.md): tablas y permisos.
--   config_pagos, perfiles_fiscales, cobros, bolsas, movimientos_bolsa,
--   liquidaciones y liquidaciones_lineas.
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el SQL
-- Editor de Supabase (proyecto "ruleafit").
--
-- Solo crea tablas vacías: no cambia nada de lo que existe ni de lo que ve el
-- usuario. Las funciones que escriben en ellas llegan en sql/072. Con el
-- interruptor config_pagos.pagos_activos en false (valor por defecto) la web no
-- usa nada de esto.
--
-- Principios:
--  * Importes siempre en céntimos enteros.
--  * Los usuarios solo LEEN lo suyo. Todo se escribe desde funciones
--    SECURITY DEFINER o con la clave de servicio (sin políticas de insert,
--    update ni delete para usuarios).
--  * Los registros de dinero no se borran en cascada al borrar un usuario: se
--    conservan (la ley obliga a guardar datos de facturación). Por eso las
--    referencias a usuarios son "set null" o "restrict", no "cascade".
--    Consecuencia: eliminar_mi_cuenta() (sql/068) deberá comprobar que no haya
--    saldo ni cobros pendientes antes de activar los pagos (pendiente en 072).
--  * El IBAN se guarda cifrado (pgcrypto); la clave va en Supabase Vault y se
--    crea antes de sql/072 (ver las instrucciones en ese archivo).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) Función auxiliar: mantener updated_at
-- ----------------------------------------------------------------------------
create or replace function public.pagos_tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- 1) config_pagos: una sola fila con los parámetros
-- ----------------------------------------------------------------------------
create table if not exists public.config_pagos (
  id                          boolean primary key default true check (id), -- una única fila
  comision_bps                integer not null default 1000
                                check (comision_bps between 0 and 10000),   -- 1000 = 10 %
  minimo_liquidacion_centimos integer not null default 1000
                                check (minimo_liquidacion_centimos >= 0),   -- 10,00 €
  horas_liberacion            integer not null default 48
                                check (horas_liberacion >= 0),
  dias_aceptacion_factura     integer not null default 15
                                check (dias_aceptacion_factura > 0),
  pagos_activos               boolean not null default false,               -- interruptor general
  updated_at                  timestamptz not null default now()
);

insert into public.config_pagos (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_config_pagos_updated on public.config_pagos;
create trigger trg_config_pagos_updated
  before update on public.config_pagos
  for each row execute function public.pagos_tocar_updated_at();

alter table public.config_pagos enable row level security;
-- Sin políticas ni permisos: solo la clave de servicio y las funciones SECURITY DEFINER.
revoke all on public.config_pagos from anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2) perfiles_fiscales: datos para emitir las autofacturas y pagar
--    Tabla aparte de perfiles (que es pública). El usuario solo puede LEERLA
--    (sin el IBAN cifrado); escribe a través de guardar_perfil_fiscal() (072).
-- ----------------------------------------------------------------------------
create table if not exists public.perfiles_fiscales (
  usuario_id                 uuid primary key references auth.users(id) on delete restrict,
  tipo                       text not null
                               check (tipo in ('persona_fisica_profesional',
                                               'persona_fisica_empresarial',
                                               'sociedad')),
  nombre_fiscal              text not null check (char_length(nombre_fiscal) between 2 and 200),
  tipo_documento             text not null check (tipo_documento in ('DNI', 'NIE', 'CIF')),
  nif                        text not null check (nif ~ '^[0-9A-Z]{9}$'),
  direccion                  text not null check (char_length(direccion) between 3 and 250),
  codigo_postal              text not null check (codigo_postal ~ '^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$'),
  municipio                  text not null check (char_length(municipio) between 2 and 120),
  provincia                  text not null check (char_length(provincia) between 2 and 80),
  pais                       text not null default 'ES' check (pais = 'ES'),
  zona_fiscal                text not null
                               check (zona_fiscal in ('peninsula_baleares', 'navarra_pais_vasco',
                                                      'canarias', 'ceuta_melilla')),
  email_facturas             text not null check (email_facturas ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  titular_iban               text not null check (char_length(titular_iban) between 2 and 200),
  iban_cifrado               bytea,
  iban_ultimos4              text check (iban_ultimos4 ~ '^[0-9]{4}$'),
  fecha_nacimiento           date,   -- personas físicas (informe anual de plataformas)
  retencion_reducida         boolean not null default false, -- IRPF reducido si lo declara
  acepta_terminos_version    text not null,
  acepta_autofactura_version text not null,
  declara_ingresos           boolean not null check (declara_ingresos),
  responsable_datos          boolean not null check (responsable_datos),
  aceptado_en                timestamptz not null,
  aceptado_ip                inet,
  estado                     text not null default 'pendiente_revision'
                               check (estado in ('incompleto', 'pendiente_revision', 'activo', 'bloqueado')),
  revisado_en                timestamptz,
  revisado_por               uuid references auth.users(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- Una identidad fiscal por cuenta.
  constraint perfiles_fiscales_nif_unico unique (nif)
);

drop trigger if exists trg_perfiles_fiscales_updated on public.perfiles_fiscales;
create trigger trg_perfiles_fiscales_updated
  before update on public.perfiles_fiscales
  for each row execute function public.pagos_tocar_updated_at();

alter table public.perfiles_fiscales enable row level security;

drop policy if exists "ver mi perfil fiscal" on public.perfiles_fiscales;
create policy "ver mi perfil fiscal"
  on public.perfiles_fiscales for select to authenticated
  using (auth.uid() = usuario_id);

-- Permisos por columna: el IBAN cifrado no se puede leer desde el navegador.
revoke all on public.perfiles_fiscales from anon, authenticated;
grant select (
  usuario_id, tipo, nombre_fiscal, tipo_documento, nif, direccion, codigo_postal,
  municipio, provincia, pais, zona_fiscal, email_facturas, titular_iban,
  iban_ultimos4, fecha_nacimiento, retencion_reducida, acepta_terminos_version,
  acepta_autofactura_version, declara_ingresos, responsable_datos, aceptado_en,
  estado, revisado_en, created_at, updated_at
) on public.perfiles_fiscales to authenticated;


-- ----------------------------------------------------------------------------
-- 3) cobros: cada cobro de un alumno
--    clase/alumno/entrenador se conservan aunque se borre la cuenta o la
--    sesión (set null) y se guarda una copia del título.
-- ----------------------------------------------------------------------------
create table if not exists public.cobros (
  id                  uuid primary key default gen_random_uuid(),
  clase_id            uuid references public.clases(id) on delete set null,
  clase_titulo        text,
  cliente_id          uuid references auth.users(id) on delete set null,
  entrenador_id       uuid references auth.users(id) on delete set null,
  reserva_id          uuid references public.reservas(id) on delete set null,
  importe_centimos    integer not null check (importe_centimos > 0),
  comision_bps        integer not null check (comision_bps between 0 and 10000),
  comision_centimos   integer not null check (comision_centimos >= 0),
  neto_centimos       integer not null check (neto_centimos >= 0),
  metodo              text not null default 'tarjeta' check (metodo in ('tarjeta', 'bizum')),
  estado              text not null default 'creado'
                        check (estado in ('creado', 'pagado', 'fallido', 'requiere_reembolso', 'reembolsado')),
  pedido_redsys       text not null unique check (pedido_redsys ~ '^[0-9]{4}[0-9A-Za-z]{0,8}$'),
  codigo_respuesta    text,
  codigo_autorizacion text,
  pagado_en           timestamptz,
  liberado_en         timestamptz,  -- cuando el neto pasó de pendiente a disponible
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint cobros_reparto_suma check (comision_centimos + neto_centimos = importe_centimos)
);

create index if not exists cobros_entrenador_estado_idx on public.cobros (entrenador_id, estado);
create index if not exists cobros_cliente_idx on public.cobros (cliente_id);
create index if not exists cobros_pagados_sin_liberar_idx
  on public.cobros (pagado_en) where estado = 'pagado' and liberado_en is null;

drop trigger if exists trg_cobros_updated on public.cobros;
create trigger trg_cobros_updated
  before update on public.cobros
  for each row execute function public.pagos_tocar_updated_at();

alter table public.cobros enable row level security;

drop policy if exists "ver mis cobros" on public.cobros;
create policy "ver mis cobros"
  on public.cobros for select to authenticated
  using (auth.uid() = cliente_id or auth.uid() = entrenador_id);

revoke all on public.cobros from anon, authenticated;
grant select on public.cobros to authenticated;


-- ----------------------------------------------------------------------------
-- 4) bolsas: saldo virtual de cada entrenador
--    pendiente  = cobrado pero aún en plazo de reclamación.
--    disponible = lo que se le liquidará (puede ser negativo si hay un
--                 reembolso posterior a una liquidación; se descuenta de la
--                 siguiente).
-- ----------------------------------------------------------------------------
create table if not exists public.bolsas (
  entrenador_id        uuid primary key references auth.users(id) on delete restrict,
  pendiente_centimos   bigint not null default 0 check (pendiente_centimos >= 0),
  disponible_centimos  bigint not null default 0,
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_bolsas_updated on public.bolsas;
create trigger trg_bolsas_updated
  before update on public.bolsas
  for each row execute function public.pagos_tocar_updated_at();

alter table public.bolsas enable row level security;

drop policy if exists "ver mi bolsa" on public.bolsas;
create policy "ver mi bolsa"
  on public.bolsas for select to authenticated
  using (auth.uid() = entrenador_id);

revoke all on public.bolsas from anon, authenticated;
grant select on public.bolsas to authenticated;


-- ----------------------------------------------------------------------------
-- 5) liquidaciones (cierres de los días 15 y último de mes) y sus líneas
--    Se crean aquí; las rellenan las funciones de la fase 2.
-- ----------------------------------------------------------------------------
create table if not exists public.liquidaciones (
  id              uuid primary key default gen_random_uuid(),
  periodo_inicio  date not null,
  periodo_fin     date not null,
  fecha_pago      date not null,
  estado          text not null default 'abierta' check (estado in ('abierta', 'cerrada', 'pagada')),
  total_centimos  bigint not null default 0 check (total_centimos >= 0),
  cerrada_en      timestamptz,
  created_at      timestamptz not null default now(),
  constraint liquidaciones_periodo_valido check (periodo_fin >= periodo_inicio),
  constraint liquidaciones_periodo_unico unique (periodo_inicio, periodo_fin)
);

alter table public.liquidaciones enable row level security;
-- Sin políticas ni permisos: solo servicio.
revoke all on public.liquidaciones from anon, authenticated;

create table if not exists public.liquidaciones_lineas (
  id               uuid primary key default gen_random_uuid(),
  liquidacion_id   uuid not null references public.liquidaciones(id) on delete restrict,
  entrenador_id    uuid not null references auth.users(id) on delete restrict,
  importe_centimos bigint not null check (importe_centimos > 0),
  iban_ultimos4    text check (iban_ultimos4 ~ '^[0-9]{4}$'),
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  factura_id       uuid,  -- se enlazará con la tabla de facturas (fase 2)
  created_at       timestamptz not null default now(),
  constraint liquidaciones_lineas_unica unique (liquidacion_id, entrenador_id)
);

create index if not exists liquidaciones_lineas_entrenador_idx on public.liquidaciones_lineas (entrenador_id);

alter table public.liquidaciones_lineas enable row level security;

drop policy if exists "ver mis lineas de liquidacion" on public.liquidaciones_lineas;
create policy "ver mis lineas de liquidacion"
  on public.liquidaciones_lineas for select to authenticated
  using (auth.uid() = entrenador_id);

revoke all on public.liquidaciones_lineas from anon, authenticated;
grant select on public.liquidaciones_lineas to authenticated;


-- ----------------------------------------------------------------------------
-- 6) movimientos_bolsa: registro contable que SOLO se añade
--    Cada cambio de saldo deja una fila. Un trigger impide modificar o borrar
--    filas (ni siquiera con la clave de servicio): las correcciones se hacen con
--    un movimiento de ajuste.
-- ----------------------------------------------------------------------------
create table if not exists public.movimientos_bolsa (
  id               bigint generated always as identity primary key,
  entrenador_id    uuid not null references auth.users(id) on delete restrict,
  cobro_id         uuid references public.cobros(id) on delete set null,
  liquidacion_id   uuid references public.liquidaciones(id) on delete set null,
  tipo             text not null
                     check (tipo in ('abono_pendiente', 'liberacion', 'reembolso',
                                     'contracargo', 'liquidacion', 'ajuste')),
  bolsa            text not null check (bolsa in ('pendiente', 'disponible')),
  importe_centimos bigint not null check (importe_centimos <> 0),
  nota             text,
  created_at       timestamptz not null default now()
);

-- Idempotencia: un cobro solo puede abonarse y liberarse una vez.
create unique index if not exists movimientos_bolsa_cobro_tipo_unico
  on public.movimientos_bolsa (cobro_id, tipo, bolsa)
  where tipo in ('abono_pendiente', 'liberacion');

create index if not exists movimientos_bolsa_entrenador_idx
  on public.movimientos_bolsa (entrenador_id, created_at desc);

create or replace function public.movimientos_bolsa_solo_insertar()
returns trigger
language plpgsql
as $$
begin
  raise exception 'movimientos_bolsa solo admite inserciones: corrige con un movimiento de ajuste'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_movimientos_bolsa_inmutable on public.movimientos_bolsa;
create trigger trg_movimientos_bolsa_inmutable
  before update or delete on public.movimientos_bolsa
  for each row execute function public.movimientos_bolsa_solo_insertar();

alter table public.movimientos_bolsa enable row level security;

drop policy if exists "ver mis movimientos" on public.movimientos_bolsa;
create policy "ver mis movimientos"
  on public.movimientos_bolsa for select to authenticated
  using (auth.uid() = entrenador_id);

revoke all on public.movimientos_bolsa from anon, authenticated;
grant select on public.movimientos_bolsa to authenticated;


-- ----------------------------------------------------------------------------
-- Comprobación posterior (solo lectura):
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('config_pagos','perfiles_fiscales','cobros','bolsas',
--                         'movimientos_bolsa','liquidaciones','liquidaciones_lineas');
--   select * from public.config_pagos;   -- debe devolver 1 fila con pagos_activos = false
-- ----------------------------------------------------------------------------
