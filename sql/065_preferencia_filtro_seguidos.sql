-- ============================================================================
-- Ruleafit · 065_preferencia_filtro_seguidos.sql
-- Nueva columna public.perfiles.filtro_clases_solo_seguidos, para la opción
-- "Mantener este filtro activado siempre que entre" añadida el 2 de octubre
-- de 2026 al filtro "Solo sesiones de ruleros a los que sigo" de
-- app/clases/page.js (Explora y reserva).
--
-- Se guarda en la cuenta (no en el navegador/localStorage) a petición
-- explícita del usuario, para que la preferencia siga al usuario aunque
-- cambie de dispositivo.
--
-- Depende de sql/004_perfiles.sql (tabla public.perfiles, con su política
-- "cada usuario actualiza su propio perfil" ya existente - no hace falta
-- tocar RLS, esa política ya permite a cualquier usuario autenticado
-- actualizar cualquier columna de su propia fila).
-- ============================================================================

alter table public.perfiles
  add column if not exists filtro_clases_solo_seguidos boolean not null default false;

comment on column public.perfiles.filtro_clases_solo_seguidos is
  'Si está activado, el filtro "Solo sesiones de ruleros a los que sigo" de /clases se enciende automáticamente al entrar, sin que el usuario tenga que pulsar el botón cada vez. Se actualiza desde app/clases/page.js al marcar/desmarcar la casilla "Mantener este filtro activado siempre que entre".';
