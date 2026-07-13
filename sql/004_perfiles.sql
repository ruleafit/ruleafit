-- ============================================================================
-- Openfit · 004_perfiles.sql
-- Nombres de usuario: tabla public.perfiles, generación automática al
-- registrarse, backfill para las cuentas ya existentes, y actualización de
-- reservas_de_mis_clases() para mostrar el username en vez del email.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "openfit").
--
-- Depende de sql/001_reservas.sql y sql/002_panel_entrenador.sql (tablas
-- public.clases / public.reservas y función reservas_de_mis_clases ya
-- creadas y ejecutadas).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Tabla public.perfiles
--    Formato de username: 3-20 caracteres, solo letras ASCII, números y
--    guion bajo (sin espacios ni símbolos). Único de forma insensible a
--    mayúsculas/minúsculas mediante índice único sobre lower(username), en
--    vez de una restricción "unique" normal (que sí distinguiría mayúsculas).
-- ----------------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  created_at timestamptz not null default now(),
  constraint perfiles_username_formato check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

comment on table public.perfiles is
  'Un perfil por usuario, con su nombre público (username). Se crea automáticamente al registrarse (ver trigger crear_perfil_para_usuario_nuevo) o mediante backfill para cuentas ya existentes.';

create unique index perfiles_username_unique_ci
  on public.perfiles (lower(username));


-- ----------------------------------------------------------------------------
-- 2) RLS: lectura abierta a cualquier autenticado, escritura solo del propio
--    perfil.
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;

create policy "autenticados ven todos los perfiles"
  on public.perfiles
  for select
  to authenticated
  using (true);

create policy "cada usuario inserta su propio perfil"
  on public.perfiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "cada usuario actualiza su propio perfil"
  on public.perfiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ----------------------------------------------------------------------------
-- 3) Funciones auxiliares para generar el username por defecto.
--    No se exponen como RPC (se revoca EXECUTE a PUBLIC y no se concede a
--    authenticated): solo las usan, internamente, el trigger de registro
--    (más abajo) y el backfill de este mismo archivo.
-- ----------------------------------------------------------------------------

-- 3a) A partir de un email, deriva una base de username válida: parte antes
--     de la @, en minúsculas, quitando cualquier carácter que no sea
--     letra/número/guion bajo, recortada a 20 caracteres y rellenada hasta
--     un mínimo de 3 si hiciera falta.
create or replace function public.generar_username_desde_email(p_email text)
returns text
language plpgsql
as $$
declare
  v_base text;
begin
  v_base := lower(coalesce(split_part(p_email, '@', 1), ''));
  v_base := regexp_replace(v_base, '[^a-z0-9_]', '', 'g');

  if v_base = '' then
    v_base := 'usuario';
  end if;

  v_base := substr(v_base, 1, 20);

  -- Si queda por debajo del mínimo de 3 caracteres, se rellena con dígitos
  -- al azar (no con un carácter fijo, para no generar el mismo relleno
  -- siempre que la parte del email sea igual de corta).
  while length(v_base) < 3 loop
    v_base := v_base || floor(random() * 10)::int::text;
  end loop;

  return v_base;
end;
$$;

revoke all on function public.generar_username_desde_email(text) from public;

-- 3b) A partir de una base ya válida en formato, devuelve un username libre:
--     si "base" ya existe (comparando en minúsculas), prueba "base_1",
--     "base_2", etc., recortando la base si hace falta para no superar los
--     20 caracteres con el sufijo incluido.
create or replace function public.username_disponible_o_sufijo(p_base text)
returns text
language plpgsql
as $$
declare
  v_candidato text;
  v_sufijo    int := 0;
  v_sufijo_texto text;
  v_base_recortada text;
begin
  v_candidato := p_base;

  loop
    exit when not exists (
      select 1 from public.perfiles where lower(username) = lower(v_candidato)
    );

    v_sufijo := v_sufijo + 1;
    v_sufijo_texto := '_' || v_sufijo::text;
    v_base_recortada := substr(p_base, 1, greatest(20 - length(v_sufijo_texto), 1));
    v_candidato := v_base_recortada || v_sufijo_texto;
  end loop;

  return v_candidato;
end;
$$;

revoke all on function public.username_disponible_o_sufijo(text) from public;


-- ----------------------------------------------------------------------------
-- 4) Trigger: al crear un usuario en auth.users, crea automáticamente su
--    fila en public.perfiles.
--    SECURITY DEFINER porque, en el momento de este trigger, todavía no hay
--    una sesión con auth.uid() = new.id (el registro está en curso), así
--    que la política de INSERT de perfiles ("id = auth.uid()") no se
--    cumpliría con los privilegios normales del solicitante.
-- ----------------------------------------------------------------------------
create or replace function public.crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username_solicitado text;
  v_base  text;
  v_final text;
begin
  -- Si el formulario de registro ya envía un username válido en
  -- user_metadata (options.data.username en supabase.auth.signUp), se
  -- respeta. Si no viene, o no cumple el formato, se genera uno por
  -- defecto a partir del email.
  v_username_solicitado := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  if v_username_solicitado is not null
     and v_username_solicitado ~ '^[A-Za-z0-9_]{3,20}$' then
    v_base := v_username_solicitado;
  else
    v_base := public.generar_username_desde_email(new.email);
  end if;

  v_final := public.username_disponible_o_sufijo(v_base);

  insert into public.perfiles (id, username)
  values (new.id, v_final)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_crear_perfil on auth.users;

create trigger on_auth_user_created_crear_perfil
  after insert on auth.users
  for each row
  execute function public.crear_perfil_para_usuario_nuevo();


-- ----------------------------------------------------------------------------
-- 5) Backfill: crea un perfil para cada cuenta de auth.users que todavía no
--    tenga uno (las cuentas de prueba actuales), con el mismo criterio que
--    el trigger (username derivado del email, con sufijo si hay conflicto).
--    Se procesa fila a fila y en orden de creación (created_at) dentro de
--    un único bloque PL/pgSQL para que cada username generado tenga en
--    cuenta, de inmediato, los perfiles ya insertados por filas anteriores
--    de este mismo backfill (evita que dos emails que generarían la misma
--    base terminen con el mismo username).
-- ----------------------------------------------------------------------------
do $$
declare
  v_usuario record;
  v_base    text;
  v_final   text;
begin
  for v_usuario in
    select u.id, u.email
    from auth.users u
    left join public.perfiles p on p.id = u.id
    where p.id is null
    order by u.created_at asc
  loop
    v_base := public.generar_username_desde_email(v_usuario.email);
    v_final := public.username_disponible_o_sufijo(v_base);

    insert into public.perfiles (id, username)
    values (v_usuario.id, v_final);
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) Actualiza reservas_de_mis_clases(): cliente_email -> cliente_username.
--    Cambiar el nombre/tipo de una columna de salida no es compatible con
--    CREATE OR REPLACE FUNCTION para funciones que devuelven TABLE, así que
--    hay que borrarla primero y volver a crearla (y volver a conceder los
--    permisos de ejecución, que se pierden al borrar la función).
--    LEFT JOIN + coalesce: si un cliente no tuviera perfil todavía (no
--    debería pasar tras el backfill y el trigger, pero por robustez), la
--    función no falla, devuelve 'usuario' como username de repuesto.
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
  'Devuelve las reservas activas de las clases publicadas por el entrenador autenticado (id de reserva, datos de la clase y username del cliente), ordenadas por fecha/hora de la clase y luego por fecha de reserva. SECURITY DEFINER para poder validar el rol en auth.users de forma controlada; el filtro por trainer_id = auth.uid() impide ver clases de otros entrenadores. LEFT JOIN con perfiles: si un cliente no tuviera perfil, se devuelve "usuario" en vez de fallar.';

revoke all on function public.reservas_de_mis_clases() from public;
grant execute on function public.reservas_de_mis_clases() to authenticated;
