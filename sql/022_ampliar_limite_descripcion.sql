-- ============================================================================
-- Ruleafit · 022_ampliar_limite_descripcion.sql
-- Amplía el CHECK de public.perfiles.descripcion de 300 a 3000 caracteres.
--
-- Por qué: el límite de producto real es 300 PALABRAS, no caracteres, y ese
-- límite se controla en el frontend (app/cuenta/page.js). El CHECK en base de
-- datos original (sql/020) usaba char_length <= 300, que en la práctica
-- limitaba a ~300 caracteres (bastante menos que 300 palabras) y podía
-- rechazar guardados válidos desde el frontend. Se sube a 3000 caracteres
-- como red de seguridad amplia (cubre 300 palabras con margen de sobra),
-- no como el límite real de producto.
--
-- Idempotente: DROP CONSTRAINT IF EXISTS antes de crear la nueva, para poder
-- reejecutar el archivo sin error si ya se aplicó.
--
-- NO toca la columna, su nullability, comentarios ni las políticas RLS de
-- perfiles (sql/004 y sql/019 siguen aplicando igual).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Sustituir el CHECK de longitud de descripcion
-- ----------------------------------------------------------------------------
alter table public.perfiles
  drop constraint if exists perfiles_descripcion_longitud;

alter table public.perfiles
  add constraint perfiles_descripcion_longitud check (char_length(descripcion) <= 3000);
