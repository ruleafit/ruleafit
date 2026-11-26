-- Ruleafit · 097_endurecer_pagos.sql
-- Fija search_path en dos funciones auxiliares de pagos (aviso de Supabase). Sin efecto visible.
alter function public.pagos_tocar_updated_at() set search_path = public;
alter function public.movimientos_bolsa_solo_insertar() set search_path = public;
-- Reversión: alter function public.pagos_tocar_updated_at() reset search_path;
--            alter function public.movimientos_bolsa_solo_insertar() reset search_path;
