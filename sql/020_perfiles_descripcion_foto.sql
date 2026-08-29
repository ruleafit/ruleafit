-- ============================================================================
-- Ruleafit · 020_perfiles_descripcion_foto.sql
-- Añade a public.perfiles dos columnas opcionales para el futuro perfil
-- público de entrenador: una bio corta (descripcion) y la URL de la foto de
-- perfil (foto_url). Ambas nullable: no afectan a los perfiles existentes ni
-- al trigger de registro (crear_perfil_para_usuario_nuevo, sql/004), que
-- sigue insertando solo id y username.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existen; el CHECK se
-- crea con un nombre explícito y DROP CONSTRAINT IF EXISTS antes, para poder
-- reejecutar el archivo sin error si ya se aplicó.
--
-- NO toca las políticas RLS de perfiles (sql/004 y sql/019 ya cubren lectura
-- pública y escritura solo del propio perfil, y aplican igual a las columnas
-- nuevas). NO crea ningún bucket de Storage: foto_url de momento solo es una
-- columna de texto, sin relación técnica con Storage hasta que se configure
-- en un paso posterior.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo
-- manualmente en el editor SQL de Supabase (proyecto "openfit").
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Columnas nuevas en public.perfiles
-- ----------------------------------------------------------------------------
alter table public.perfiles
  add column if not exists descripcion text,
  add column if not exists foto_url text;

alter table public.perfiles
  drop constraint if exists perfiles_descripcion_longitud;

alter table public.perfiles
  add constraint perfiles_descripcion_longitud check (char_length(descripcion) <= 300);


-- ----------------------------------------------------------------------------
-- 2) Comentarios
-- ----------------------------------------------------------------------------
comment on column public.perfiles.descripcion is
  'Bio corta del entrenador (o cliente), máximo 300 caracteres. Opcional.';

comment on column public.perfiles.foto_url is
  'URL pública de la foto de perfil del usuario, alojada en Supabase Storage. Opcional; de momento es solo texto, sin bucket configurado todavía.';
