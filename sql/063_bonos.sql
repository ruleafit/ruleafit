-- ============================================================================
-- Ruleafit · 063_bonos.sql
-- Sistema de bonos: el entrenador crea bonos (número de sesiones o
-- ilimitadas, plazo, precio, descripción libre) y los clientes los
-- adquieren y los consumen al reservar sesiones de ese entrenador.
--
-- Especificación de producto acordada con el usuario (ver
-- claude/pendientes-generales.md, punto 3 de "Pendientes activos"):
--   - Modelo único configurable (no hay "bono mensual" y "bono de sesiones"
--     como productos separados).
--   - "Ilimitadas" es un toggle explícito (numero_sesiones = null), nunca
--     un número muy alto puesto a mano.
--   - Sin límites automáticos por semana ni por tipo de clase: si el
--     entrenador quiere repartir las sesiones, lo explica en la
--     descripción libre y lo controla él mismo. El sistema solo cuenta el
--     total de sesiones y la fecha límite.
--   - Al terminar el plazo, las sesiones no consumidas se pierden siempre
--     (el frontend debe avisar de esto ANTES de confirmar la compra).
--   - Bonos no reembolsables una vez comprados, salvo que no se haya
--     consumido ninguna sesión (regla de producto, no impuesta aquí a
--     nivel de base de datos: no hay pago real todavía, ver más abajo).
--
-- IMPORTANTE — no hay pago real todavía (Fase 6 sin implementar): esta
-- migración construye toda la mecánica (crear bono, comprarlo, consumirlo
-- al reservar) exactamente igual que ya funciona reservar_clase() hoy sin
-- cobrar nada. "Adquirir" un bono no cobra ningún dinero ahora mismo; el
-- precio queda guardado en la tabla para cuando se conecte el pago real.
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el
-- SQL Editor de Supabase (proyecto "ruleafit").
--
-- Depende de: sql/001 (tabla reservas y reservar_clase), sql/060
-- (versión vigente de reservar_clase, sin bloqueo de rol) — ambas ya
-- ejecutadas y vigentes hoy en la base de datos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Tabla public.bonos — los bonos que un entrenador ofrece.
-- ----------------------------------------------------------------------------
create table public.bonos (
  id               uuid primary key default gen_random_uuid(),
  trainer_id       uuid not null references auth.users(id) on delete cascade,
  numero_sesiones  integer,                      -- null = ilimitadas
  plazo_dias       integer not null,
  precio           numeric(10,2) not null,
  descripcion      text,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint bonos_numero_sesiones_positivo check (numero_sesiones is null or numero_sesiones > 0),
  constraint bonos_plazo_dias_positivo check (plazo_dias > 0),
  constraint bonos_precio_no_negativo check (precio >= 0)
);

comment on table public.bonos is
  'Bonos que un entrenador ofrece a sus clientes: número de sesiones (null = ilimitadas), plazo en días para consumirlas, precio y descripción libre. No hay tipos de producto separados a propósito (modelo único, decisión de producto del 21 sept 2026).';

create index bonos_trainer_id_idx on public.bonos (trainer_id);


-- ----------------------------------------------------------------------------
-- 2) Tabla public.bonos_clientes — adquisiciones de un bono por un cliente.
--    fecha_fin se calcula una sola vez al adquirir (plazo_dias del bono en
--    ese momento), así que un cambio posterior del plazo en el bono no
--    afecta a bonos ya comprados.
-- ----------------------------------------------------------------------------
create table public.bonos_clientes (
  id            uuid primary key default gen_random_uuid(),
  bono_id       uuid not null references public.bonos(id) on delete cascade,
  cliente_id    uuid not null references auth.users(id) on delete cascade,
  fecha_inicio  timestamptz not null default now(),
  fecha_fin     timestamptz not null,
  created_at    timestamptz not null default now()
);

comment on table public.bonos_clientes is
  'Una adquisición concreta de un bono por un cliente. El consumo (sesiones_usadas) no se guarda aquí: se calcula siempre contando las reservas activas de public.reservas vinculadas por bono_cliente_id, para que cancelar una reserva libere el uso automáticamente sin tocar ningún contador.';

create index bonos_clientes_bono_id_idx on public.bonos_clientes (bono_id);
create index bonos_clientes_cliente_id_idx on public.bonos_clientes (cliente_id);


-- ----------------------------------------------------------------------------
-- 3) public.reservas: columna nueva para vincular una reserva al bono que
--    la ha pagado (null si la reserva es suelta, como todas hasta ahora).
-- ----------------------------------------------------------------------------
alter table public.reservas
  add column bono_cliente_id uuid references public.bonos_clientes(id) on delete set null;

create index reservas_bono_cliente_id_idx on public.reservas (bono_cliente_id);


-- ----------------------------------------------------------------------------
-- 4) RLS de public.bonos.
--    Lectura: cualquier autenticado ve los bonos activos de cualquiera
--    (para poder mostrarlos en el perfil público de un entrenador) y el
--    propio entrenador ve también los suyos aunque estén desactivados.
--    Escritura: un usuario solo puede crear/editar bonos a su propio
--    nombre — igual que la política de "Crear clases" ya existente. Sin
--    política de delete a propósito: para dejar de ofrecer un bono se
--    desactiva (activo = false), nunca se borra, así se conserva el
--    histórico de quién lo compró.
-- ----------------------------------------------------------------------------
alter table public.bonos enable row level security;

create policy "bonos activos visibles a todos, propios siempre visibles"
  on public.bonos
  for select
  to authenticated
  using (activo = true or trainer_id = auth.uid());

create policy "crear bonos propios"
  on public.bonos
  for insert
  to authenticated
  with check (trainer_id = auth.uid());

create policy "editar bonos propios"
  on public.bonos
  for update
  to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5) RLS de public.bonos_clientes.
--    Solo lectura por política: el cliente ve las suyas, el entrenador ve
--    las de sus propios bonos (para ver compradores y consumo). Sin
--    políticas de insert/update/delete: toda escritura pasa por
--    adquirir_bono() (SECURITY DEFINER, más abajo) — mismo patrón que la
--    tabla reservas desde sql/001.
-- ----------------------------------------------------------------------------
alter table public.bonos_clientes enable row level security;

create policy "clientes ven sus propios bonos comprados"
  on public.bonos_clientes
  for select
  to authenticated
  using (cliente_id = auth.uid());

create policy "entrenadores ven compradores de sus bonos"
  on public.bonos_clientes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bonos
      where bonos.id = bonos_clientes.bono_id
        and bonos.trainer_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 6) Función RPC adquirir_bono(p_bono_id uuid).
--    "Adquirir" no cobra nada todavía (no hay pago real, ver cabecera del
--    archivo): simplemente registra la compra con su fecha de caducidad,
--    lista para cuando se conecte el TPV en Fase 6.
-- ----------------------------------------------------------------------------
create or replace function public.adquirir_bono(p_bono_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id      uuid;
  v_bono            record;
  v_bono_cliente_id uuid;
  v_fecha_fin       timestamptz;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para adquirir un bono.' using errcode = '28000';
  end if;

  select id, trainer_id, plazo_dias, activo
    into v_bono
    from public.bonos
    where id = p_bono_id
    for update;

  if not found then
    raise exception 'El bono no existe.' using errcode = 'P0002';
  end if;

  if not v_bono.activo then
    raise exception 'Este bono ya no está disponible.' using errcode = 'P0001';
  end if;

  if v_bono.trainer_id = v_usuario_id then
    raise exception 'No puedes adquirir tu propio bono.' using errcode = '42501';
  end if;

  v_fecha_fin := now() + (v_bono.plazo_dias || ' days')::interval;

  insert into public.bonos_clientes (bono_id, cliente_id, fecha_inicio, fecha_fin)
  values (p_bono_id, v_usuario_id, now(), v_fecha_fin)
  returning id into v_bono_cliente_id;

  return jsonb_build_object(
    'ok', true,
    'bono_cliente_id', v_bono_cliente_id,
    'fecha_fin', v_fecha_fin
  );
end;
$$;

comment on function public.adquirir_bono(uuid) is
  'Registra la adquisición de un bono por el usuario autenticado (no puede ser su propio bono, ni estar desactivado). Calcula fecha_fin a partir del plazo_dias del bono en el momento de la compra. No cobra ningún dinero real (Fase 6 sin implementar): el precio queda guardado en el bono para cuando exista el pago.';

revoke all on function public.adquirir_bono(uuid) from public;
grant execute on function public.adquirir_bono(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 7) Función RPC mis_bonos_comprados() — vista del cliente: los bonos que
--    ha adquirido, de quién, y cuánto le queda por consumir.
-- ----------------------------------------------------------------------------
create or replace function public.mis_bonos_comprados()
returns table (
  bono_cliente_id  uuid,
  bono_id          uuid,
  trainer_id       uuid,
  trainer_username text,
  descripcion      text,
  precio           numeric,
  numero_sesiones  integer,
  sesiones_usadas  bigint,
  fecha_inicio     timestamptz,
  fecha_fin        timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  return query
    select
      bc.id as bono_cliente_id,
      b.id as bono_id,
      b.trainer_id,
      coalesce(p.username, 'usuario') as trainer_username,
      b.descripcion,
      b.precio,
      b.numero_sesiones,
      count(r.id) filter (where r.estado = 'activa') as sesiones_usadas,
      bc.fecha_inicio,
      bc.fecha_fin
    from public.bonos_clientes bc
    join public.bonos b on b.id = bc.bono_id
    left join public.perfiles p on p.id = b.trainer_id
    left join public.reservas r on r.bono_cliente_id = bc.id
    where bc.cliente_id = v_usuario_id
    group by bc.id, b.id, p.username
    order by bc.fecha_fin desc;
end;
$$;

comment on function public.mis_bonos_comprados() is
  'Bonos adquiridos por el usuario autenticado, con el entrenador, la descripción, el consumo calculado (sesiones_usadas, contando reservas activas vinculadas) y las fechas de vigencia.';

revoke all on function public.mis_bonos_comprados() from public;
grant execute on function public.mis_bonos_comprados() to authenticated;


-- ----------------------------------------------------------------------------
-- 8) Función RPC compradores_de_mis_bonos() — vista del entrenador: quién
--    ha comprado cada uno de sus bonos y cuánto le queda por consumir.
-- ----------------------------------------------------------------------------
create or replace function public.compradores_de_mis_bonos()
returns table (
  bono_id          uuid,
  bono_descripcion text,
  bono_precio      numeric,
  numero_sesiones  integer,
  bono_activo      boolean,
  bono_cliente_id  uuid,
  cliente_username text,
  sesiones_usadas  bigint,
  fecha_inicio     timestamptz,
  fecha_fin        timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  return query
    select
      b.id as bono_id,
      b.descripcion as bono_descripcion,
      b.precio as bono_precio,
      b.numero_sesiones,
      b.activo as bono_activo,
      bc.id as bono_cliente_id,
      coalesce(p.username, 'usuario') as cliente_username,
      count(r.id) filter (where r.estado = 'activa') as sesiones_usadas,
      bc.fecha_inicio,
      bc.fecha_fin
    from public.bonos b
    left join public.bonos_clientes bc on bc.bono_id = b.id
    left join public.perfiles p on p.id = bc.cliente_id
    left join public.reservas r on r.bono_cliente_id = bc.id
    where b.trainer_id = v_usuario_id
    group by b.id, bc.id, p.username
    order by b.created_at desc, bc.fecha_fin desc nulls last;
end;
$$;

comment on function public.compradores_de_mis_bonos() is
  'Todos los bonos publicados por el usuario autenticado, con cada comprador (si los hay) y su consumo calculado. Un bono sin compradores aparece con las columnas de bono_cliente a null.';

revoke all on function public.compradores_de_mis_bonos() from public;
grant execute on function public.compradores_de_mis_bonos() to authenticated;


-- ----------------------------------------------------------------------------
-- 9) reservar_clase(): añade el consumo automático de bono, sin cambiar la
--    forma de llamarla desde el frontend (sigue aceptando solo p_clase_id).
--    Si el usuario tiene un bono activo y con hueco para este entrenador,
--    se usa automáticamente (decisión de producto: sin preguntar, un solo
--    clic como hoy); si no tiene ninguno, reserva suelta exactamente igual
--    que hasta ahora. Se borra primero porque cambia lo que devuelve
--    (columna nueva usado_bono en el jsonb no afecta al tipo de retorno,
--    pero se borra por seguridad ya que también cambian las variables
--    internas — mismo criterio que sql/060 al tocar esta función).
-- ----------------------------------------------------------------------------
drop function if exists public.reservar_clase(uuid);

create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id      uuid;
  v_clase           record;
  v_clase_inicio    timestamp;
  v_ahora_local     timestamp;
  v_ahora_utc       timestamptz;
  v_reserva_id      uuid;
  v_ya_reservada    boolean;
  v_bono_cliente_id uuid;
  v_bono_candidato  record;
  v_usadas          bigint;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = '28000';
  end if;

  -- 2. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine: si dos reservas llegan a la vez para la misma
  --    clase, la segunda espera a que la primera confirme o falle antes de
  --    leer plazas_ocupadas, así nunca ven ambas el mismo hueco libre.
  select id, trainer_id, estado, fecha, hora, plazas_max, plazas_ocupadas
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 3. No puedes reservar tu propia clase.
  if v_clase.trainer_id = v_usuario_id then
    raise exception 'No puedes reservar tu propia sesión.' using errcode = '42501';
  end if;

  -- 4. Debe estar activa y no haber empezado ya (fecha + hora exactas,
  --    comparadas en hora local de España).
  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');
  v_ahora_utc := now();

  if v_clase_inicio < v_ahora_local then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 5. No debe estar completa.
  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;

  -- 6. El usuario no debe tener ya una reserva activa para esta clase.
  select exists (
    select 1
    from public.reservas
    where clase_id = p_clase_id
      and cliente_id = v_usuario_id
      and estado = 'activa'
  ) into v_ya_reservada;

  if v_ya_reservada then
    raise exception 'Ya tienes una reserva activa para esta clase.' using errcode = 'P0001';
  end if;

  -- 7. Bonos (nuevo, sql/063): busca un bono del usuario con este
  --     entrenador que todavía no haya caducado, ordenado por el que
  --     caduque antes (para gastar primero el más urgente). De los que
  --     caben por fecha, se queda con el primero que además tenga hueco
  --     por número de sesiones (o sea ilimitado). Si no hay ninguno,
  --     v_bono_cliente_id se queda en null y la reserva es suelta, igual
  --     que hasta ahora.
  for v_bono_candidato in
    select bc.id as bc_id, b.numero_sesiones
    from public.bonos_clientes bc
    join public.bonos b on b.id = bc.bono_id
    where bc.cliente_id = v_usuario_id
      and b.trainer_id = v_clase.trainer_id
      and bc.fecha_fin >= v_ahora_utc
    order by bc.fecha_fin asc
    for update of bc
  loop
    if v_bono_candidato.numero_sesiones is null then
      v_bono_cliente_id := v_bono_candidato.bc_id;
      exit;
    end if;

    select count(*)
      into v_usadas
      from public.reservas
      where bono_cliente_id = v_bono_candidato.bc_id
        and estado = 'activa';

    if v_usadas < v_bono_candidato.numero_sesiones then
      v_bono_cliente_id := v_bono_candidato.bc_id;
      exit;
    end if;
  end loop;

  -- 8. Insertar la reserva (con o sin bono vinculado).
  insert into public.reservas (clase_id, cliente_id, bono_cliente_id)
  values (p_clase_id, v_usuario_id, v_bono_cliente_id)
  returning id into v_reserva_id;

  -- 9. Incrementar las plazas ocupadas de la clase.
  update public.clases
    set plazas_ocupadas = plazas_ocupadas + 1
    where id = p_clase_id;

  -- 10. Resultado claro de éxito, indicando si se ha usado un bono.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'clase_id', p_clase_id,
    'plazas_ocupadas', v_clase.plazas_ocupadas + 1,
    'plazas_max', v_clase.plazas_max,
    'usado_bono', v_bono_cliente_id is not null
  );
end;
$$;

comment on function public.reservar_clase(uuid) is
  'Reserva una clase para el usuario autenticado de forma atómica: valida que no sea su propia clase, el estado de la clase, aforo y duplicados, bloquea la fila de la clase para evitar sobreventa, inserta la reserva e incrementa plazas_ocupadas. Desde sql/063, si el usuario tiene un bono activo y con hueco para este entrenador lo consume automáticamente (sin preguntar); si no, la reserva es suelta igual que siempre. El resultado indica en "usado_bono" si se ha consumido uno.';

revoke all on function public.reservar_clase(uuid) from public;
grant execute on function public.reservar_clase(uuid) to authenticated;


-- ============================================================================
-- Fin. Después de ejecutar este archivo, comprobar en el SQL Editor (sin
-- errores en ninguna sentencia) y hacer una prueba rápida:
--   select public.mis_bonos_comprados();          -- debe devolver 0 filas
--   select public.compradores_de_mis_bonos();      -- debe devolver 0 filas
-- (0 filas es el resultado correcto: todavía no existe ningún bono).
-- ============================================================================
