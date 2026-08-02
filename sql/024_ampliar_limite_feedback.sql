-- ============================================================================
-- Openfit · 024_ampliar_limite_feedback.sql
-- Amplía el CHECK de public.feedback.mensaje de 1000 a 5000 caracteres.
--
-- Por qué: el límite de 1000 caracteres (sql/023) resultaba demasiado corto
-- para mensajes de feedback algo más detallados (por ejemplo, describir un
-- problema paso a paso). Se sube a 5000, manteniendo la condición de que el
-- mensaje no esté vacío (char_length(trim(mensaje)) > 0).
--
-- Idempotente: DROP CONSTRAINT IF EXISTS antes de crear la nueva, para poder
-- reejecutar el archivo sin error si ya se aplicó.
--
-- NO toca la tabla, sus columnas, comentarios ni las políticas RLS de
-- feedback (sql/023 sigue aplicando igual).
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Sustituir el CHECK de longitud de mensaje
-- ----------------------------------------------------------------------------
alter table public.feedback
  drop constraint if exists feedback_mensaje_longitud;

alter table public.feedback
  add constraint feedback_mensaje_longitud
  check (char_length(mensaje) <= 5000 and char_length(trim(mensaje)) > 0);
