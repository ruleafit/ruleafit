-- Ruleafit · 084 reversión · NO EJECUTADO. Restaura la versión de sql/081 (solo recorta espacios de los extremos).
create or replace function public.avisos_zona_texto_cuerpo(
  p_titulo text, p_ciudad text, p_fecha date, p_hora time, p_username text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(coalesce(p_titulo, '')), 80)
      || ' · ' || btrim(coalesce(p_ciudad, ''))
      || ' · ' || (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from p_fecha)::int + 1]
      || ' ' || extract(day from p_fecha)::int::text
      || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from p_fecha)::int]
      || ', ' || to_char(p_hora, 'HH24:MI')
      || ' (de @' || coalesce(p_username, 'organizador') || ')'
$$;
