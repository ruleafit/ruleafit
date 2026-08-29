-- ============================================================================
-- Ruleafit · 019_fk_clases_perfiles_y_rls_publica.sql
-- Habilita mostrar el username del entrenador en las consultas de clases:
--
--   (a) Añade una foreign key de public.clases.trainer_id a
--       public.perfiles.id. Sin esta FK, PostgREST (la capa que usa
--       Supabase para los embeds tipo select('*, perfiles(username)')) no
--       puede detectar la relación entre clases y perfiles: hoy
--       trainer_id solo referencia auth.users(id), y perfiles.id también
--       referencia auth.users(id) pero de forma independiente, sin FK
--       directa entre clases y perfiles.
--
--   (b) Amplía la política de SELECT de public.perfiles para que el
--       username sea legible por el rol "public" (incluye "anon", no solo
--       "authenticated"). Es necesario porque /clases y /clases/[id] son
--       páginas públicas (accesibles sin sesión iniciada, según la
--       política "Ver clases activas" de public.clases), y con la
--       política actual ("to authenticated") un visitante sin sesión no
--       podría leer perfiles en absoluto: el embed devolvería el username
--       vacío para esos visitantes aunque la FK del punto (a) esté bien.
--       perfiles no contiene ningún dato sensible (solo id, username y
--       created_at), y el username ya se documenta en CLAUDE.md como
--       "público", así que ampliar su lectura a todo el mundo es
--       coherente con el diseño actual.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
--
-- Depende de sql/004_perfiles.sql (tabla public.perfiles y su política de
-- SELECT actual) y sql/016_tabla_clases.sql (tabla public.clases con
-- trainer_id references auth.users(id)), ambas ya ejecutadas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Foreign key: clases.trainer_id -> perfiles.id
--    Ya existe una FK de trainer_id a auth.users(id) (declarada en la
--    creación de la tabla, sql/016_tabla_clases.sql). Postgres permite
--    perfectamente que una misma columna tenga más de una foreign key,
--    siempre que cada una apunte a una tabla distinta y el valor las
--    cumpla todas: aquí no hay conflicto porque perfiles.id ES
--    auth.users.id (perfiles.id references auth.users(id) on delete
--    cascade, ver sql/004_perfiles.sql), así que cualquier trainer_id que
--    ya sea válido contra auth.users también lo será contra perfiles,
--    siempre que su perfil exista. Esto está garantizado en la práctica:
--    el trigger on_auth_user_created_crear_perfil crea el perfil en el
--    mismo instante del registro, antes de que ese usuario pueda llegar a
--    publicar ninguna clase.
--
--    Sobre el ON DELETE CASCADE: ambas FKs (a auth.users y a perfiles)
--    tienen on delete cascade y no entran en conflicto entre sí. Si se
--    borra un usuario de auth.users, la cascada de perfiles.id
--    (references auth.users(id) on delete cascade) borra primero (o en el
--    mismo instante, según el orden de resolución de Postgres) la fila de
--    perfiles, lo que a su vez dispara la cascada de esta nueva FK y
--    borra las clases de ese entrenador; el resultado final es el mismo
--    que ya se producía solo con la FK a auth.users. No debería haber
--    ninguna violación de integridad ni orden problemático, porque las
--    dos cascadas terminan borrando las mismas clases.
-- ----------------------------------------------------------------------------
alter table public.clases
  add constraint clases_trainer_id_perfiles_fkey
  foreign key (trainer_id) references public.perfiles(id) on delete cascade;


-- ----------------------------------------------------------------------------
-- 2) RLS de perfiles: username legible públicamente (rol "public", incluye
--    "anon"), no solo por usuarios autenticados.
--    Sustituye la política "autenticados ven todos los perfiles" (creada
--    en sql/004_perfiles.sql, to authenticated) por una equivalente pero
--    abierta también a visitantes sin sesión.
-- ----------------------------------------------------------------------------
drop policy if exists "autenticados ven todos los perfiles" on public.perfiles;

create policy "perfiles visibles publicamente"
  on public.perfiles
  for select
  to public
  using (true);
