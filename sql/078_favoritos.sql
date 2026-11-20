-- 078_favoritos.sql
-- "Favoritos": lista PRIVADA de ruleros favoritos de cada usuario, independiente
-- de "Seguir" (public.seguimientos, sql/028), que no se toca.
--
-- Qué hace (todo idempotente y sin borrar datos):
--   1. Crea public.favoritos (usuario_id -> favorito_id) con RLS PRIVADA:
--      cada usuario solo ve, crea y borra SUS filas. El favorito no puede
--      consultar quién lo tiene (a diferencia de seguimientos, que es de
--      lectura pública) y no recibe ningún aviso.
--   2. Añade perfiles.filtro_clases_solo_favoritos (default false) para la
--      casilla "Mantener este filtro activado siempre que entre" del filtro
--      "Usuarios favoritos" de /clases. Se usa una columna NUEVA y no la de
--      sql/065 (seguidos) para que nadie encuentre /clases con un filtro
--      activado y vacío por haber fijado antes el de seguidos.
--   3. Reemplaza notificar_publicacion_clase(): al publicarse una sesión activa
--      se notifica SOLO a quienes tienen al autor en favoritos (ya no a sus
--      seguidores). Como lee únicamente public.favoritos, que tiene
--      UNIQUE (usuario_id, favorito_id), una persona que es favorita y además
--      seguida genera UNA sola notificación.
--      Es lo ÚNICO que cambia respecto a la función anterior (sql/046): se
--      mantienen la condición de sesión activa, el nombre del autor (con su
--      valor por defecto), el texto y la URL de la notificación y la llamada
--      a generar_notificacion. El trigger no se toca.
--      La preferencia "Nuevas sesiones de mis ruleros favoritos" es la misma
--      categoría 'publicaciones' de siempre (preferencias_notificaciones):
--      se conserva lo que cada usuario ya tenía configurado. Si está
--      desactivada no se genera nada (ni push ni entrada en el historial).
--      Opt-out como el resto: sin fila = activa.
--      La función es SECURITY DEFINER con search_path vacío (set search_path
--      = ''): todo lo que usa va con su esquema (public.xxx), así que no
--      depende de ningún search_path y nadie puede suplantar una tabla o
--      función creando otra con el mismo nombre en otro esquema.
--
-- Cómo aplicarlo: manualmente, completo y de una vez, en el SQL Editor de
-- Supabase (New query -> pegar -> Run). NO lo ejecuta ninguna herramienta.
-- Hazlo justo antes (o justo después) de desplegar el código nuevo: el código
-- consulta public.favoritos y, hasta que exista, la pestaña Favoritos falla.
-- Mientras no se ejecute, las notificaciones de nuevas sesiones siguen yendo
-- a los seguidores, como hasta ahora.

-- ---------------------------------------------------------------------------
-- 1. Tabla y RLS privada
-- ---------------------------------------------------------------------------
create table if not exists public.favoritos (
    id           uuid primary key default gen_random_uuid(),
    usuario_id   uuid not null references auth.users(id) on delete cascade,
    favorito_id  uuid not null references auth.users(id) on delete cascade,
    created_at   timestamptz not null default now(),
    unique (usuario_id, favorito_id),
    check (usuario_id <> favorito_id)
);

-- "Mis favoritos" (pestaña de Ruleros) y "quién tiene a este autor" (trigger).
create index if not exists favoritos_usuario_idx  on public.favoritos (usuario_id, created_at desc);
create index if not exists favoritos_favorito_idx on public.favoritos (favorito_id);

alter table public.favoritos enable row level security;

drop policy if exists "favoritos: lee los suyos" on public.favoritos;
create policy "favoritos: lee los suyos"
    on public.favoritos
    for select
    to authenticated
    using ( (select auth.uid()) = usuario_id );

drop policy if exists "favoritos: crea los suyos" on public.favoritos;
create policy "favoritos: crea los suyos"
    on public.favoritos
    for insert
    to authenticated
    with check ( (select auth.uid()) = usuario_id );

drop policy if exists "favoritos: borra los suyos" on public.favoritos;
create policy "favoritos: borra los suyos"
    on public.favoritos
    for delete
    to authenticated
    using ( (select auth.uid()) = usuario_id );

-- Sin política de UPDATE: un favorito se crea o se borra, no se edita.
-- Sin acceso para anon (sin sesión no hay favoritos).
revoke all on public.favoritos from anon;
grant select, insert, delete on public.favoritos to authenticated;
-- Supabase concede por defecto a authenticated todos los permisos en las tablas
-- nuevas de public: se quitan los que sobran (sin UPDATE no se edita; TRUNCATE
-- no pasa por la RLS). Se queda solo con SELECT, INSERT y DELETE.
revoke update, truncate, references, trigger on public.favoritos from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Preferencia del filtro "Usuarios favoritos" de /clases
-- ---------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists filtro_clases_solo_favoritos boolean not null default false;

comment on column public.perfiles.filtro_clases_solo_favoritos is
  'Si está activado, el filtro "Usuarios favoritos" de /clases se enciende solo al entrar. Sustituye a filtro_clases_solo_seguidos (sql/065), que queda sin uso.';

-- ---------------------------------------------------------------------------
-- 3. Notificaciones de nuevas sesiones: de seguidores a favoritos
-- ---------------------------------------------------------------------------
create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_destinatario uuid;
begin
  -- Solo notificamos si la clase se crea activa.
  if new.estado is distinct from 'activa' then
    return new;
  end if;

  -- Nombre visible del autor.
  select username into v_username
  from public.perfiles
  where id = new.trainer_id;

  if v_username is null then
    v_username := 'Tu entrenador';
  end if;

  -- Una notificacion por cada usuario que tiene al autor en favoritos y no ha
  -- desactivado "Nuevas sesiones de mis ruleros favoritos" (categoria
  -- 'publicaciones'; sin fila = activa). Los seguidores que no lo tienen en
  -- favoritos NO reciben nada.
  for v_destinatario in
    select f.usuario_id
    from public.favoritos f
    where f.favorito_id = new.trainer_id
      and coalesce(
            (select pn.activo
               from public.preferencias_notificaciones pn
              where pn.usuario_id = f.usuario_id
                and pn.categoria = 'publicaciones'),
            true
          )
  loop
    perform public.generar_notificacion(
      v_destinatario,
      'sesion_publicada',
      'Nueva sesion de ' || v_username,
      v_username || ' ha publicado: ' || new.titulo,
      '/clases/' || new.id::text
    );
  end loop;

  return new;
end;
$$;

-- El trigger trg_notificar_publicacion (AFTER INSERT ON public.clases) ya existe
-- y apunta a esta función por nombre: no hace falta tocarlo.

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN (después de ejecutar)
--   a) La tabla existe con RLS activada y 3 políticas:
--        select relrowsecurity from pg_class where oid = 'public.favoritos'::regclass;
--        select policyname, cmd from pg_policies where tablename = 'favoritos';
--   b) La función ya no menciona seguimientos:
--        select position('seguimientos' in pg_get_functiondef('public.notificar_publicacion_clase()'::regprocedure)) = 0 as sin_seguimientos;
--   c) El trigger sigue apuntando a la función y esta tiene search_path vacío:
--        select t.tgname, p.proname, p.proconfig
--        from pg_trigger t join pg_proc p on p.oid = t.tgfoid
--        where t.tgname = 'trg_notificar_publicacion';
--      (proconfig debe mostrar {search_path=""}).
--
-- PARA REVERTIR (vuelve a notificar a los seguidores; los favoritos guardados
-- se conservan en la tabla): volver a ejecutar sql/046_publicacion_via_generar.sql.
-- Para borrar también la funcionalidad (DESTRUCTIVO, borra los favoritos):
--   drop table public.favoritos;
--   alter table public.perfiles drop column filtro_clases_solo_favoritos;
-- ---------------------------------------------------------------------------
