-- ============================================================================
-- Ruleafit · 090_ubicaciones_habituales_reversion.sql
-- Deshace N09: elimina la tabla de ubicaciones habituales (se pierden las ubicaciones guardadas).
-- Las sesiones y series publicadas NO se tocan: nunca dependieron de esta tabla.
-- ============================================================================
drop trigger if exists trg_ubicaciones_habituales_guardar on public.ubicaciones_habituales;
drop function if exists public.ubicaciones_habituales_antes_de_guardar();
drop table if exists public.ubicaciones_habituales;
