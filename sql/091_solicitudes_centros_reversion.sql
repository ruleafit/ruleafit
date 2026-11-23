-- ============================================================================
-- Ruleafit · 091_solicitudes_centros_reversion.sql
-- Deshace N15: elimina la tabla y la función de solicitudes de centros (se pierden las solicitudes guardadas;
-- expórtalas antes si las necesitas).
-- ============================================================================
drop function if exists public.registrar_solicitud_centro(text, text, text, text, text, text, text, boolean);
drop trigger if exists trg_solicitudes_centros_tocar on public.solicitudes_centros;
drop function if exists public.solicitudes_centros_tocar();
drop table if exists public.solicitudes_centros;
