-- 031_motivo_cancelacion.sql
-- Añade a public.clases una columna para registrar POR QUE se cancelo una sesion.
-- NULL = sin cancelar (o sin motivo registrado).
-- 'entrenador' = cancelacion manual por el entrenador.
-- 'minimo'     = cancelacion automatica por no alcanzar plazas_min.
-- YA EJECUTADO en Supabase. Archivo creado para mantener el historial completo de sql/.

ALTER TABLE public.clases
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

ALTER TABLE public.clases
  ADD CONSTRAINT clases_motivo_cancelacion_check
  CHECK (motivo_cancelacion IN ('entrenador', 'minimo'));
