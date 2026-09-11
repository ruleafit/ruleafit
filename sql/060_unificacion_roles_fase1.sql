-- ============================================================================
-- Ruleafit · 060_unificacion_roles_fase1.sql
-- Fase 1 del plan de unificación cliente/entrenador (ver
-- claude/plan-unificacion-cliente-entrenador.md en el proyecto de Claude).
-- Quita las seis barreras de rol que impedían que un mismo usuario pudiera
-- reservar Y publicar sesiones, y añade la única regla nueva que hacía
-- falta: que un entrenador no pueda reservar su propia clase.
--
-- El campo user_metadata.rol ('cliente'/'entrenador') deja de leerse en
-- estas seis funciones/políticas a partir de aquí. No se toca ni se borra
-- el dato en sí (queda como campo sin uso, no hace falta limpiarlo), y no
-- hace falta ninguna migración de datos de usuarios existentes.
--
-- NO EJECUTADO todavía. Preparado para revisión y ejecución manual en el
-- SQL Editor de Supabase (proyecto "ruleafit").
--
-- Depende de: sql/001 (reservar_clase), sql/004 (reservas_de_mis_clases),
-- sql/054 (mis_clases), sql/016 (política RLS de clases), sql/030
-- (listar_entrenadores), sql/058 (otorgar_rulos_perfil_entrenador) — todas
-- ya ejecutadas y vigentes hoy en la base de datos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) reservar_clase(): quita el bloqueo "solo clientes" y añade, en el
--    mismo cambio, la regla de que un usuario no puede reservar una clase
--    de la que él mismo es trainer_id. Van juntas a propósito: no tiene
--    sentido abrir la reserva a cualquiera sin cerrar a la vez el hueco de
--    reservarte a ti mismo.
--    Único cambio real respecto a la versión anterior: se quita el bloque
--    "2. Debe ser un usuario con rol cliente" y se añade una comprobación
--    de propiedad justo después de bloquear la fila de la clase (paso 3),
--    aprovechando que ya se tiene v_clase.trainer_id disponible ahí mismo.
-- ----------------------------------------------------------------------------
create or replace function public.reservar_clase(p_clase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id   uuid;
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

  -- 3. No puedes reservar tu propia clase (regla nueva: antes era imposible
  --    porque el bloqueo de rol ya impedía que un mismo usuario pudiera ser
  --    a la vez cliente y entrenador; ahora hay que comprobarlo a propósito).
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
  'Reserva una clase para el usuario autenticado de forma atómica: valida que no sea su propia clase, el estado de la clase, aforo y duplicados, bloquea la fila de la clase para evitar sobreventa, inserta la reserva e incrementa plazas_ocupadas. Ya no exige rol "cliente" (Fase 1 de la unificación de roles, 11 sept 2026).';


-- ----------------------------------------------------------------------------
-- 2) reservas_de_mis_clases(): quita el bloqueo "solo entrenadores". Resto
--    de la función idéntico a la versión vigente (sql/004).
--    Se borra primero porque Postgres no permite cambiar el tipo de la fila
--    devuelta (columnas OUT) con CREATE OR REPLACE; hay que borrar y volver
--    a crear cuando cambian las columnas de salida.
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
  reservado_en     public.reservas.created_at%type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  -- 1. Debe haber usuario autenticado.
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  -- 2. Solo reservas activas de clases cuyo trainer_id sea el usuario
  --    autenticado. El filtro "c.trainer_id = v_usuario_id" es la única
  --    condición que importa para el aislamiento entre usuarios: da igual
  --    qué reservas existan en la tabla, esta función nunca puede devolver
  --    una fila cuya clase pertenezca a otro usuario.
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
  'Devuelve las reservas activas de las clases publicadas por el usuario autenticado (id de reserva, datos de la clase y username del cliente), ordenadas por fecha/hora de la clase y luego por fecha de reserva. Ya no exige rol "entrenador" (Fase 1 de la unificación de roles, 11 sept 2026); el filtro por trainer_id = auth.uid() sigue impidiendo ver clases de otros usuarios.';

revoke all on function public.reservas_de_mis_clases() from public;
grant execute on function public.reservas_de_mis_clases() to authenticated;


-- ----------------------------------------------------------------------------
-- 3) mis_clases(): quita el mismo bloqueo "solo entrenadores" (tercera
--    función encontrada con esta barrera). Resto idéntico a la versión
--    vigente (sql/054).
--    Se borra primero por el mismo motivo que el punto 2 (cambio de
--    columnas de salida).
-- ----------------------------------------------------------------------------
drop function if exists public.mis_clases();

create or replace function public.mis_clases()
returns table (
  clase_id            public.clases.id%type,
  titulo              public.clases.titulo%type,
  categoria           public.clases.categoria%type,
  fecha               public.clases.fecha%type,
  hora                public.clases.hora%type,
  plazas_max          public.clases.plazas_max%type,
  plazas_min          public.clases.plazas_min%type,
  plazas_ocupadas     public.clases.plazas_ocupadas%type,
  estado              public.clases.estado%type,
  motivo_cancelacion  public.clases.motivo_cancelacion%type,
  reservas_activas    bigint
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
      c.id as clase_id,
      c.titulo,
      c.categoria,
      c.fecha,
      c.hora,
      c.plazas_max,
      c.plazas_min,
      c.plazas_ocupadas,
      c.estado,
      c.motivo_cancelacion,
      count(r.id) filter (where r.estado = 'activa') as reservas_activas
    from public.clases c
    left join public.reservas r on r.clase_id = c.id
    where c.trainer_id = v_usuario_id
    group by c.id
    order by c.fecha asc, c.hora asc;
end;
$$;

comment on function public.mis_clases() is
  'Devuelve todas las clases publicadas por el usuario autenticado (tengan o no reservas, sea cual sea su estado), con el recuento de reservas activas de cada una y motivo_cancelacion. Ya no exige rol "entrenador" (Fase 1 de la unificación de roles, 11 sept 2026); el filtro por trainer_id = auth.uid() sigue impidiendo ver clases de otros usuarios. No sustituye a reservas_de_mis_clases(), que sigue siendo la fuente del listado de alumnos por clase.';

revoke all on function public.mis_clases() from public;
grant execute on function public.mis_clases() to authenticated;


-- ----------------------------------------------------------------------------
-- 4) Política RLS de clases: cualquier usuario autenticado puede publicar
--    una clase a su propio nombre, ya no solo quien tenga rol "entrenador".
-- ----------------------------------------------------------------------------
drop policy if exists "Crear clases (solo entrenadores)" on public.clases;
create policy "Crear clases"
  on public.clases
  for insert
  to authenticated
  with check (
    auth.uid() = trainer_id
  );


-- ----------------------------------------------------------------------------
-- 5) listar_entrenadores(): quita el filtro de rol, devuelve todos los
--    perfiles. Se mantiene el nombre de la función tal cual (nombre interno,
--    no lo ve el usuario) para no tener que borrar/recrear permisos.
--    Se borra primero por el mismo motivo que los puntos 2 y 3 (cambio de
--    columnas de salida).
-- ----------------------------------------------------------------------------
drop function if exists public.listar_entrenadores();

create or replace function public.listar_entrenadores()
returns table (
    id          uuid,
    username    text,
    descripcion text,
    foto_url    text
)
language sql
security definer
set search_path = public
as $$
    select p.id, p.username, p.descripcion, p.foto_url
    from public.perfiles p
    order by p.username asc;
$$;

comment on function public.listar_entrenadores() is
  'Lista todos los usuarios con perfil (id, username, descripción, foto). Ya no filtra por rol "entrenador" (Fase 1 de la unificación de roles, 11 sept 2026); el nombre de la función se mantiene por compatibilidad con el código existente.';

revoke all on function public.listar_entrenadores() from public;
grant execute on function public.listar_entrenadores() to authenticated;


-- ----------------------------------------------------------------------------
-- 6) otorgar_rulos_perfil_entrenador() (trigger de perfiles): quita el
--    filtro de rol, cualquier usuario recibe los 20+20 Rulos al completar
--    foto y descripción por primera vez. Resto de la función idéntico a la
--    versión vigente (sql/058): misma guarda doble contra doble concesión.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos_perfil_entrenador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cantidad_rulos     constant integer := 20;
  v_tenia_foto         boolean;
  v_tiene_foto         boolean;
  v_tenia_descripcion  boolean;
  v_tiene_descripcion  boolean;
begin
  -- 1. Bono por foto de perfil: transición de sin foto a con foto.
  v_tenia_foto := coalesce(old.foto_url, '') <> '';
  v_tiene_foto := coalesce(new.foto_url, '') <> '';

  if v_tiene_foto and not v_tenia_foto and not exists (
    select 1 from public.rulos_movimientos
      where referencia_tipo = 'perfil'
        and referencia_id = new.id
        and motivo = 'foto_perfil'
  ) then
    perform public.otorgar_rulos(
      p_usuario_id      => new.id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'foto_perfil',
      p_referencia_tipo => 'perfil',
      p_referencia_id   => new.id,
      p_otorgado_por    => null,
      p_nota            => null
    );
  end if;

  -- 2. Bono por descripción de perfil: transición de vacía/nula a con texto.
  v_tenia_descripcion := coalesce(trim(old.descripcion), '') <> '';
  v_tiene_descripcion := coalesce(trim(new.descripcion), '') <> '';

  if v_tiene_descripcion and not v_tenia_descripcion and not exists (
    select 1 from public.rulos_movimientos
      where referencia_tipo = 'perfil'
        and referencia_id = new.id
        and motivo = 'descripcion_perfil'
  ) then
    perform public.otorgar_rulos(
      p_usuario_id      => new.id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'descripcion_perfil',
      p_referencia_tipo => 'perfil',
      p_referencia_id   => new.id,
      p_otorgado_por    => null,
      p_nota            => null
    );
  end if;

  return new;
end;
$$;

comment on function public.otorgar_rulos_perfil_entrenador() is
  'Trigger AFTER UPDATE en perfiles: concede 20 Rulos, una sola vez, a cualquier usuario que complete por primera vez su foto de perfil, y otros 20 al completar por primera vez su descripción. Ya no distingue rol (Fase 1 de la unificación de roles, 11 sept 2026). Guarda doble contra doble concesión: solo actúa en la transición vacío->con contenido y además comprueba que no exista ya un movimiento con esa referencia.';

-- El trigger en sí (on_perfil_actualizado_otorgar_rulos) no cambia: sigue
-- disparándose en la misma condición (foto_url o descripcion cambiaron), la
-- función que ejecuta es la que se acaba de redefinir arriba.


-- ============================================================================
-- Fin de la Fase 1. Después de ejecutar este archivo, comprobar en el SQL
-- Editor (sin errores en ninguna sentencia) y hacer una prueba rápida:
--   select public.listar_entrenadores();  -- debe devolver todos los perfiles
-- Ver claude/plan-unificacion-cliente-entrenador.md para la Fase 2 en adelante.
-- ============================================================================
