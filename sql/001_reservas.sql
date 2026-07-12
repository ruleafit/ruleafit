-- ============================================================================
-- Openfit · 001_reservas.sql
-- Sistema de reservas: tabla, restricciones, RLS y función RPC atómica.
--
-- EJECUTADO el 12 de julio de 2026 en el proyecto Supabase "openfit".
--
-- Nota: /clases (frontend) actualmente solo filtra clases pasadas por fecha,
-- no por hora. Esta función es más estricta (fecha+hora). Alinear en el
-- futuro si se quiere evitar que una clase ya empezada hoy siga visible en
-- el listado.
--
-- Supuestos sobre la tabla public.clases ya existente (a partir del código
-- de app/publicar/page.js y app/clases/page.js):
--   - id             uuid primary key (generado por Supabase)
--   - trainer_id     uuid, referencia a auth.users(id)
--   - estado         text, valor 'activa' usado para clases visibles/publicables
--   - fecha          date (formato YYYY-MM-DD, viene de un <input type="date">)
--   - hora           time o text (formato HH:MM, viene de un <input type="time">)
--   - plazas_max     integer
--   - plazas_ocupadas integer
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) Extensión necesaria para gen_random_uuid()
--    Supabase la trae activada por defecto; el IF NOT EXISTS hace este paso
--    inofensivo si ya lo está.
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- 1) Tabla public.reservas
-- ----------------------------------------------------------------------------
create table public.reservas (
  id           uuid primary key default gen_random_uuid(),
  clase_id     uuid not null references public.clases(id) on delete cascade,
  cliente_id   uuid not null references auth.users(id) on delete cascade,
  estado       text not null default 'activa' check (estado in ('activa', 'cancelada')),
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table public.reservas is
  'Reservas de clientes sobre clases. Solo se escribe a través de funciones RPC (ver reservar_clase).';


-- ----------------------------------------------------------------------------
-- 2) Un cliente no puede tener dos reservas ACTIVAS para la misma clase.
--    Índice único parcial: solo restringe filas con estado = 'activa', así que
--    un cliente puede tener varias reservas 'cancelada' históricas de la
--    misma clase (p.ej. si reserva, cancela, y vuelve a reservar).
-- ----------------------------------------------------------------------------
create unique index reservas_cliente_clase_activa_unique
  on public.reservas (clase_id, cliente_id)
  where estado = 'activa';

-- Índices de apoyo para las políticas RLS y las consultas típicas
-- ("mis reservas", "reservas de mis clases").
create index reservas_cliente_id_idx on public.reservas (cliente_id);
create index reservas_clase_id_idx on public.reservas (clase_id);


-- ----------------------------------------------------------------------------
-- 3) RLS: activar y definir políticas de SOLO LECTURA.
--    No se crean políticas de INSERT/UPDATE/DELETE a propósito: sin una
--    política que lo permita, RLS deniega esas operaciones por defecto para
--    cualquier rol que no sea el propietario de la tabla. Todas las
--    escrituras deben pasar por reservar_clase() (SECURITY DEFINER, más
--    abajo), que sí puede escribir porque se ejecuta con los privilegios del
--    propietario de la función, no con los del cliente que la llama.
-- ----------------------------------------------------------------------------
alter table public.reservas enable row level security;

create policy "clientes ven sus propias reservas"
  on public.reservas
  for select
  to authenticated
  using (cliente_id = auth.uid());

create policy "entrenadores ven reservas de sus clases"
  on public.reservas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clases
      where clases.id = reservas.clase_id
        and clases.trainer_id = auth.uid()
    )
  );

-- Sin políticas de insert/update/delete: quedan bloqueadas para
-- authenticated y anon por defecto en cuanto RLS está activo.


-- ----------------------------------------------------------------------------
-- 4) Función RPC reservar_clase(p_clase_id uuid)
--    Hace todas las comprobaciones y la escritura en una sola transacción
--    implícita: si cualquier "raise exception" salta, Postgres deshace
--    automáticamente todo lo que la función haya hecho hasta ese punto
--    (nada de reservas o incrementos de plazas a medias).
-- ----------------------------------------------------------------------------
create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id   uuid;
  v_rol          text;
  v_clase        record;
  v_clase_inicio timestamp;
  v_ahora_local  timestamp;
  v_reserva_id   uuid;
  v_ya_reservada boolean;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión para reservar.' using errcode = '28000';
  end if;

  -- 2. Debe ser un usuario con rol "cliente" (guardado en user_metadata.rol).
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = v_usuario_id;

  if v_rol is distinct from 'cliente' then
    raise exception 'Solo los clientes pueden reservar clases.' using errcode = '42501';
  end if;

  -- 3. La clase debe existir. FOR UPDATE bloquea la fila hasta que esta
  --    transacción termine: si dos reservas llegan a la vez para la misma
  --    clase, la segunda espera a que la primera confirme o falle antes de
  --    leer plazas_ocupadas, así nunca ven ambas el mismo hueco libre.
  select id, estado, fecha, hora, plazas_max, plazas_ocupadas
    into v_clase
    from public.clases
    where id = p_clase_id
    for update;

  if not found then
    raise exception 'La clase no existe.' using errcode = 'P0002';
  end if;

  -- 4. Debe estar activa y no haber empezado ya (fecha + hora exactas,
  --    comparadas en hora local de España; más estricto que el filtro
  --    solo-por-fecha que usa /clases en el frontend, ver nota al principio
  --    del archivo).
  if v_clase.estado <> 'activa' then
    raise exception 'La clase ya no está activa.' using errcode = 'P0001';
  end if;

  v_clase_inicio := (v_clase.fecha::text || ' ' || v_clase.hora::text)::timestamp;
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  if v_clase_inicio < v_ahora_local then
    raise exception 'La clase ya ha empezado o ha pasado.' using errcode = 'P0001';
  end if;

  -- 5. No debe estar completa.
  if v_clase.plazas_ocupadas >= v_clase.plazas_max then
    raise exception 'La clase está completa.' using errcode = 'P0001';
  end if;

  -- 6. El cliente no debe tener ya una reserva activa para esta clase.
  --    (El índice único parcial del punto 2 es la red de seguridad final
  --    ante condiciones de carrera; esta comprobación da un mensaje claro
  --    en el caso normal.)
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

  -- 7. Insertar la reserva.
  insert into public.reservas (clase_id, cliente_id)
  values (p_clase_id, v_usuario_id)
  returning id into v_reserva_id;

  -- 8. Incrementar las plazas ocupadas de la clase.
  update public.clases
    set plazas_ocupadas = plazas_ocupadas + 1
    where id = p_clase_id;

  -- 9. Resultado claro de éxito.
  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'clase_id', p_clase_id,
    'plazas_ocupadas', v_clase.plazas_ocupadas + 1,
    'plazas_max', v_clase.plazas_max
  );
end;
$$;

comment on function public.reservar_clase(uuid) is
  'Reserva una clase para el cliente autenticado de forma atómica: valida rol, estado de la clase, aforo y duplicados, bloquea la fila de la clase para evitar sobreventa, inserta la reserva e incrementa plazas_ocupadas.';


-- ----------------------------------------------------------------------------
-- 5) Permisos de ejecución: solo usuarios autenticados.
--    Por defecto Postgres concede EXECUTE a PUBLIC al crear una función;
--    hay que revocarlo explícitamente antes de conceder solo a authenticated.
-- ----------------------------------------------------------------------------
revoke all on function public.reservar_clase(uuid) from public;
grant execute on function public.reservar_clase(uuid) to authenticated;
