-- ============================================================================
-- Ruleafit · 084_avisos_zona_texto_espacios.sql · NO EJECUTADO (requiere autorización).
-- Corrige el texto de los avisos de zona: un título publicado con tabulador o salto de
-- línea inicial (visto en la prueba real del 22-nov-2026: «\tPRUEBA B...») se mostraba
-- tal cual. Ahora se normalizan los espacios en blanco (tabuladores, saltos, espacios
-- repetidos) del título y la ciudad. Solo cambia esta función de texto (misma firma y
-- permisos): no toca generar_notificacion, favoritos, reservas, cancelaciones ni
-- recordatorios. Reversión: sql/084_avisos_zona_texto_espacios_reversion.sql.
-- ============================================================================
create or replace function public.avisos_zona_texto_cuerpo(
  p_titulo text, p_ciudad text, p_fecha date, p_hora time, p_username text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(coalesce(p_titulo, ''), '[[:space:]]+', ' ', 'g')), 80)
      || ' · ' || btrim(regexp_replace(coalesce(p_ciudad, ''), '[[:space:]]+', ' ', 'g'))
      || ' · ' || (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from p_fecha)::int + 1]
      || ' ' || extract(day from p_fecha)::int::text
      || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from p_fecha)::int]
      || ', ' || to_char(p_hora, 'HH24:MI')
      || ' (de @' || coalesce(p_username, 'organizador') || ')'
$$;
