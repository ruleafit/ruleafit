-- ============================================================================
-- Ruleafit · 006_open_fidelizacion.sql
-- Moneda "Open" (puntos de fidelización) — MVP: saldo por usuario, historial
-- de movimientos, bienvenida automática y recompensa por asistencia
-- confirmada por el entrenador. Sin retos (fuera de esta fase), sin compra,
-- recarga, retirada ni transferencia, sin uso para reservar/pagar clases
-- (ver CLAUDE.md "Decisiones de producto (MVP)").
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql (tablas public.clases / public.reservas),
-- sql/003_cancelaciones.sql (mismo criterio de fecha+hora Europe/Madrid) y
-- sql/004_perfiles.sql (última versión de reservas_de_mis_clases(), con
-- cliente_username, que este archivo vuelve a reemplazar solo para añadir la
-- columna asistencia).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Catálogo de motivos de Open (public.open_motivos)
--    Tabla en vez de un CHECK fijo en open_movimientos: añadir un motivo
--    nuevo en el futuro (p.ej. "reto" cuando exista esa función) es un
--    INSERT en esta tabla, no un ALTER TABLE del historial.
--    Solo se seedean los dos motivos de este MVP (bienvenida y asistencia
--    confirmada); "reto" queda fuera de esta fase, tal como se acordó.
-- ----------------------------------------------------------------------------
create table public.open_motivos (
  codigo      text primary key,
  descripcion text not null
);

comment on table public.open_motivos is
  'Catálogo de motivos por los que se puede conceder Open. Tabla de referencia para que open_movimientos.motivo tenga una FK en vez de un CHECK fijo, y así se puedan añadir motivos nuevos sin tocar el esquema del historial.';

alter table public.open_motivos enable row level security;

create policy "autenticados ven el catálogo de motivos"
  on public.open_motivos
  for select
  to authenticated
  using (true);

insert into public.open_motivos (codigo, descripcion) values
  ('bienvenida', 'Bienvenida al registrarse en Openfit'),
  ('asistencia_confirmada', 'Asistencia confirmada por el entrenador a una clase reservada')
on conflict (codigo) do nothing;


-- ----------------------------------------------------------------------------
-- 2) Saldo por usuario (public.open_saldos)
--    Una fila por usuario con el saldo agregado, mantenida por
--    public.otorgar_open() (punto 4) cada vez que se inserta un movimiento,
--    para no tener que sumar todo el historial en cada lectura.
-- ----------------------------------------------------------------------------
create table public.open_saldos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  saldo      integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.open_saldos is
  'Saldo actual de Open por usuario. Se mantiene automáticamente desde open_movimientos a través de public.otorgar_open(); no se escribe nunca a mano.';

alter table public.open_saldos enable row level security;

create policy "cada usuario ve su propio saldo de Open"
  on public.open_saldos
  for select
  to authenticated
  using (usuario_id = auth.uid());

-- Sin políticas de insert/update/delete: quedan bloqueadas para
-- authenticated y anon por defecto en cuanto RLS está activo. Solo escribe
-- public.otorgar_open() (SECURITY DEFINER).


-- ----------------------------------------------------------------------------
-- 3) Historial de movimientos (public.open_movimientos)
--    Append-only: ninguna fila se edita ni se borra nunca. Cualquier
--    corrección (p.ej. el entrenador se equivoca al marcar asistencia) se
--    hace con un movimiento nuevo que compensa al anterior, nunca tocando el
--    original — así el historial que ve el cliente siempre es la verdad
--    completa de lo ocurrido.
--    referencia_tipo/referencia_id son genéricos a propósito (en vez de una
--    FK distinta por motivo) para poder enlazar el movimiento con lo que lo
--    originó — de momento solo 'reserva' para asistencia confirmada — sin
--    tener que ampliar el esquema cuando se añadan motivos nuevos.
-- ----------------------------------------------------------------------------
create table public.open_movimientos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users(id) on delete cascade,
  cantidad        integer not null check (cantidad <> 0),
  motivo          text not null references public.open_motivos(codigo),
  referencia_tipo text,
  referencia_id   uuid,
  otorgado_por    uuid references auth.users(id),
  nota            text,
  created_at      timestamptz not null default now()
);

comment on table public.open_movimientos is
  'Historial de movimientos de Open, append-only (nunca se edita ni se borra una fila). cantidad puede ser negativa: se usa para retirar Open concedido por error, siempre como movimiento nuevo compensatorio, nunca corrigiendo el original. otorgado_por es el entrenador que concedió/corrigió el movimiento (null si fue automático, p.ej. bienvenida).';

create index open_movimientos_usuario_id_idx
  on public.open_movimientos (usuario_id, created_at desc);

alter table public.open_movimientos enable row level security;

create policy "cada usuario ve su propio historial de Open"
  on public.open_movimientos
  for select
  to authenticated
  using (usuario_id = auth.uid());

-- Sin políticas de insert/update/delete: quedan bloqueadas para
-- authenticated y anon por defecto en cuanto RLS está activo. Solo escribe
-- public.otorgar_open() (SECURITY DEFINER). El entrenador NO tiene política
-- de lectura sobre el historial de Open de sus alumnos (decisión de
-- producto: solo ve/gestiona la marca de asistencia en Mis clases).


-- ----------------------------------------------------------------------------
-- 4) Función interna otorgar_open()
--    No se expone como RPC (se revoca EXECUTE a PUBLIC y no se concede a
--    authenticated ni anon): solo la usan, internamente, el trigger de
--    bienvenida y marcar_asistencia (ambas SECURITY DEFINER, así que pueden
--    llamarla aunque no tengan grant explícito, igual que
--    crear_perfil_para_usuario_nuevo llama a generar_username_desde_email en
--    sql/004_perfiles.sql).
--    Inserta el movimiento y actualiza (o crea) el saldo en la misma
--    transacción: nunca hay un movimiento sin su reflejo en el saldo.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_open(
  p_usuario_id      uuid,
  p_cantidad        integer,
  p_motivo          text,
  p_referencia_tipo text default null,
  p_referencia_id   uuid default null,
  p_otorgado_por    uuid default null,
  p_nota            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movimiento_id uuid;
begin
  if p_cantidad = 0 then
    raise exception 'La cantidad de Open no puede ser cero.' using errcode = 'P0001';
  end if;

  insert into public.open_movimientos
    (usuario_id, cantidad, motivo, referencia_tipo, referencia_id, otorgado_por, nota)
  values
    (p_usuario_id, p_cantidad, p_motivo, p_referencia_tipo, p_referencia_id, p_otorgado_por, p_nota)
  returning id into v_movimiento_id;

  insert into public.open_saldos (usuario_id, saldo, updated_at)
  values (p_usuario_id, p_cantidad, now())
  on conflict (usuario_id) do update
    set saldo = public.open_saldos.saldo + excluded.saldo,
        updated_at = now();

  return v_movimiento_id;
end;
$$;

comment on function public.otorgar_open(uuid, integer, text, text, uuid, uuid, text) is
  'Inserta un movimiento de Open y actualiza el saldo del usuario en la misma transacción. Cantidad puede ser negativa (retirar Open por corrección). No expuesta como RPC: solo la llaman, internamente, otorgar_open_bienvenida() y marcar_asistencia().';

revoke all on function public.otorgar_open(uuid, integer, text, text, uuid, uuid, text) from public;


-- ----------------------------------------------------------------------------
-- 5) Bienvenida automática al registrarse
--    Mismo patrón que crear_perfil_para_usuario_nuevo() en
--    sql/004_perfiles.sql: trigger AFTER INSERT en auth.users, SECURITY
--    DEFINER porque en ese momento no hay sesión con auth.uid() = new.id.
--    Trigger independiente del de perfiles (no se tocan entre sí); el orden
--    entre ambos no importa porque no dependen uno del otro.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_open_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.otorgar_open(
    p_usuario_id => new.id,
    p_cantidad   => 20,
    p_motivo     => 'bienvenida'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_otorgar_bienvenida on auth.users;

create trigger on_auth_user_created_otorgar_bienvenida
  after insert on auth.users
  for each row
  execute function public.otorgar_open_bienvenida();


-- ----------------------------------------------------------------------------
-- 6) Asistencia confirmada: columnas nuevas en public.reservas
--    'pendiente' por defecto para todas las reservas (incluidas las ya
--    existentes). Solo pasa a 'asistio'/'no_asistio' a través de
--    marcar_asistencia() (punto 7), nunca por escritura directa desde el
--    cliente (RLS de reservas ya no tiene políticas de UPDATE, ver
--    sql/001_reservas.sql).
-- ----------------------------------------------------------------------------
alter table public.reservas
  add column asistencia text not null default 'pendiente'
    check (asistencia in ('pendiente', 'asistio', 'no_asistio')),
  add column asistencia_marcada_en timestamptz,
  add column asistencia_marcada_por uuid references auth.users(id);

comment on column public.reservas.asistencia is
  'Marca de asistencia a la clase reservada, gestionada por el entrenador tras la clase mediante marcar_asistencia(). "asistio" concede Open de asistencia_confirmada; corregir de "asistio" a "no_asistio" (o viceversa) retira/concede el Open con un movimiento nuevo compensatorio, nunca editando el original.';


-- ----------------------------------------------------------------------------
-- 7) Función RPC marcar_asistencia(p_reserva_id uuid, p_asistio boolean)
--    Solo el entrenador dueño de la clase de esa reserva puede llamarla, y
--    solo una vez que la clase ha empezado (mismo criterio de fecha+hora
--    exacta en Europe/Madrid que reservar_clase/cancelar_reserva).
--    Corrección de errores: si ya estaba marcada como 'asistio' y se corrige
--    a 'no_asistio' (o al revés), se genera un movimiento de Open nuevo que
--    compensa el anterior en vez de tocarlo. Si se intenta marcar el mismo
--    estado que ya tiene, se rechaza para no duplicar movimientos.
-- ----------------------------------------------------------------------------
create or replace function public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id    uuid;
  v_reserva       record;
  v_clase         record;
  v_clase_inicio  timestamp;
  v_ahora_local   timestamp;
  v_estado_nuevo  text;
  v_cantidad_open constant integer := 5;
  v_movimiento_id uuid;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  -- 2. La reserva debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine, igual que reservar_clase/cancelar_reserva.
  select id, clase_id, cliente_id, estado, asistencia
    into v_reserva
    from public.reservas
    where id = p_reserva_id
    for update;

  if not found then
    raise exception 'La reserva no existe.' using errcode = 'P0002';
  end if;

  -- 3. La clase asociada debe existir y pertenecer al entrenador
  --    autenticado. Esta es la única comprobación que importa para el
  --    aislamiento entre entrenadores, mismo patrón que
  --    reservas_de_mis_clases().
  select id, trainer_id, fecha, hora
    into v_clase
    from public.clases
    where id = v_reserva.clase_id;

  if not found then
    raise exception 'La clase asociada no existe.' using errcode = 'P0002';
  end if;

  if v_clase.trainer_id <> v_usuario_id then
    raise exception 'Solo puedes marcar asistencia en tus propias clases.' using errcode = '42501';
  end if;

  -- 4. Solo tiene sentido marcar asistencia de una reserva activa.
  if v_reserva.estado <> 'activa' then
    raise exception 'No se puede marcar asistencia de una reserva cancelada.' using errcode = 'P0001';
  end if;

  -- 5. Solo se puede marcar asistencia una vez que la clase ha empezado.
  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio > v_ahora_local then
    raise exception 'No se puede marcar asistencia antes de que empiece la clase.' using errcode = 'P0001';
  end if;

  -- 6. Estado destino según el booleano recibido; rechaza si ya está así
  --    (evita movimientos de Open duplicados por doble clic, etc.).
  v_estado_nuevo := case when p_asistio then 'asistio' else 'no_asistio' end;

  if v_reserva.asistencia = v_estado_nuevo then
    raise exception 'La asistencia ya está marcada así.' using errcode = 'P0001';
  end if;

  -- 7. Actualizar el estado de asistencia de la reserva.
  update public.reservas
    set asistencia = v_estado_nuevo,
        asistencia_marcada_en = now(),
        asistencia_marcada_por = v_usuario_id
    where id = p_reserva_id;

  -- 8. Movimiento de Open, siempre nuevo y nunca editando uno anterior:
  --    - pasa a 'asistio' (desde 'pendiente' o corrigiendo desde
  --      'no_asistio'): concede el Open de asistencia confirmada.
  --    - estaba en 'asistio' y se corrige a 'no_asistio': retira el Open ya
  --      concedido con un movimiento negativo por la misma cantidad.
  --    - pasa de 'pendiente' a 'no_asistio': no genera movimiento.
  if v_estado_nuevo = 'asistio' then
    v_movimiento_id := public.otorgar_open(
      p_usuario_id      => v_reserva.cliente_id,
      p_cantidad        => v_cantidad_open,
      p_motivo          => 'asistencia_confirmada',
      p_referencia_tipo => 'reserva',
      p_referencia_id   => p_reserva_id,
      p_otorgado_por    => v_usuario_id,
      p_nota            => case
                              when v_reserva.asistencia = 'no_asistio'
                                then 'Corrección: no_asistio -> asistio'
                              else null
                            end
    );
  elsif v_reserva.asistencia = 'asistio' then
    v_movimiento_id := public.otorgar_open(
      p_usuario_id      => v_reserva.cliente_id,
      p_cantidad        => -v_cantidad_open,
      p_motivo          => 'asistencia_confirmada',
      p_referencia_tipo => 'reserva',
      p_referencia_id   => p_reserva_id,
      p_otorgado_por    => v_usuario_id,
      p_nota            => 'Corrección: asistio -> no_asistio'
    );
  end if;

  -- 9. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', p_reserva_id,
    'asistencia', v_estado_nuevo,
    'movimiento_id', v_movimiento_id
  );
end;
$$;

comment on function public.marcar_asistencia(uuid, boolean) is
  'Marca (o corrige) la asistencia de una reserva, solo para el entrenador dueño de la clase y solo una vez empezada. "asistio" concede 5 Open al cliente (asistencia_confirmada); corregir a/desde "asistio" genera un movimiento de Open nuevo que compensa al anterior, nunca edita uno existente. Rechaza si ya está marcada con el mismo estado.';

revoke all on function public.marcar_asistencia(uuid, boolean) from public;
grant execute on function public.marcar_asistencia(uuid, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 8) Actualiza reservas_de_mis_clases(): añade la columna "asistencia" para
--    que el panel del entrenador (Mis clases) pueda mostrar el estado
--    actual y decidir cuándo ofrecer marcar_asistencia(). Cambiar las
--    columnas de salida de una función TABLE no es compatible con CREATE OR
--    REPLACE, así que hay que borrarla primero (igual que ya hizo
--    sql/004_perfiles.sql al pasar de cliente_email a cliente_username).
-- ----------------------------------------------------------------------------
drop function if exists public.reservas_de_mis_clases();

create or replace function public.reservas_de_mis_clases()
returns table (
  reserva_id       uuid,
  clase_id         public.clases.id%type,
  clase_titulo     public.clases.titulo%type,
  clase_fecha      public.clases.fecha%type,
  clase_hora       public.clases.hora%type,
  plazas_max       public.clases.plazas_max%type,
  plazas_ocupadas  public.clases.plazas_ocupadas%type,
  cliente_username text,
  asistencia       public.reservas.asistencia%type,
  reservado_en     public.reservas.created_at%type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_rol        text;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  -- 2. Debe ser un usuario con rol "entrenador" (guardado en
  --    user_metadata.rol), mismo patrón que reservar_clase para "cliente".
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = v_usuario_id;

  if v_rol is distinct from 'entrenador' then
    raise exception 'Solo los entrenadores pueden ver esta información.' using errcode = '42501';
  end if;

  -- 3. Solo reservas activas de clases cuyo trainer_id sea el usuario
  --    autenticado. El filtro "c.trainer_id = v_usuario_id" es la única
  --    condición que importa para el aislamiento entre entrenadores: da
  --    igual qué reservas existan en la tabla, esta función nunca puede
  --    devolver una fila cuya clase pertenezca a otro entrenador.
  return query
    select
      r.id as reserva_id,
      c.id as clase_id,
      c.titulo as clase_titulo,
      c.fecha as clase_fecha,
      c.hora as clase_hora,
      c.plazas_max,
      c.plazas_ocupadas,
      coalesce(p.username, 'usuario') as cliente_username,
      r.asistencia as asistencia,
      r.created_at as reservado_en
    from public.reservas r
    join public.clases c on c.id = r.clase_id
    left join public.perfiles p on p.id = r.cliente_id
    where r.estado = 'activa'
      and c.trainer_id = v_usuario_id
    order by c.fecha asc, c.hora asc, r.created_at asc;
end;
$$;

comment on function public.reservas_de_mis_clases() is
  'Devuelve las reservas activas de las clases publicadas por el entrenador autenticado (id de reserva, datos de la clase, username del cliente y estado de asistencia), ordenadas por fecha/hora de la clase y luego por fecha de reserva. SECURITY DEFINER para poder validar el rol en auth.users de forma controlada; el filtro por trainer_id = auth.uid() impide ver clases de otros entrenadores. LEFT JOIN con perfiles: si un cliente no tuviera perfil, se devuelve "usuario" en vez de fallar.';

revoke all on function public.reservas_de_mis_clases() from public;
grant execute on function public.reservas_de_mis_clases() to authenticated;
