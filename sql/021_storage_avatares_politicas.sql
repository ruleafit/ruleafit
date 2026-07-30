-- ============================================================================
-- Openfit · 021_storage_avatares_politicas.sql
-- Políticas RLS sobre storage.objects para el bucket "avatares" (creado
-- manualmente en Supabase Storage como bucket PÚBLICO), donde cada usuario
-- sube su foto de perfil.
--
-- Convención de ruta asumida: {user_id}/nombre-archivo (p.ej.
-- "3fa2.../foto.jpg"), donde el primer segmento de la ruta es el uuid del
-- usuario dueño del archivo. storage.foldername(name) devuelve un array con
-- los segmentos de carpeta de la ruta, así que (storage.foldername(name))[1]
-- es ese primer segmento.
--
-- Depende de sql/020_perfiles_descripcion_foto.sql (columna
-- perfiles.foto_url, pensada para guardar la URL pública resultante de subir
-- a este bucket), pero no la usa directamente: la relación es solo de
-- propósito, no de código.
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) LECTURA: cualquiera puede ver las fotos del bucket "avatares", incluso
--    sin sesión iniciada (rol "public", incluye "anon"). Coherente con que
--    el bucket ya es público y con que perfiles.username/foto_url también
--    son legibles públicamente (sql/019).
-- ----------------------------------------------------------------------------
drop policy if exists "avatares: lectura publica" on storage.objects;

create policy "avatares: lectura publica"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatares');


-- ----------------------------------------------------------------------------
-- 2) SUBIR: solo usuarios autenticados, y solo dentro del bucket "avatares".
--    auth.uid()::text = (storage.foldername(name))[1] obliga a que el primer
--    segmento de la ruta del archivo sea el propio user id, así que un
--    usuario no puede subir un archivo dentro de la "carpeta" de otro.
-- ----------------------------------------------------------------------------
drop policy if exists "avatares: subir la propia foto" on storage.objects;

create policy "avatares: subir la propia foto"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatares'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ----------------------------------------------------------------------------
-- 3) ACTUALIZAR: solo el dueño puede sobreescribir su propia foto (mismo
--    patrón que INSERT). using() cubre la fila existente antes del update,
--    with check() la fila resultante después.
-- ----------------------------------------------------------------------------
drop policy if exists "avatares: actualizar la propia foto" on storage.objects;

create policy "avatares: actualizar la propia foto"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatares'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatares'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ----------------------------------------------------------------------------
-- 4) BORRAR: solo el dueño puede borrar su propia foto (mismo patrón).
-- ----------------------------------------------------------------------------
drop policy if exists "avatares: borrar la propia foto" on storage.objects;

create policy "avatares: borrar la propia foto"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatares'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
