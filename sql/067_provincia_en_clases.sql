-- ============================================================================
-- Ruleafit · 067_provincia_en_clases.sql
-- Nueva columna public.clases.provincia: la provincia (o comunidad uniprovincial)
-- de la ciudad elegida al publicar una sesión. Sirve para que, en /clases,
-- buscar "Sevilla" encuentre también las sesiones de Dos Hermanas, Utrera...
-- (app/clases/page.js busca el texto en ciudad Y en provincia).
--
-- EJECUTADO a mano en el SQL Editor de Supabase (proyecto "ruleafit") el 30 de
-- octubre de 2026; comprobado después con una lectura de solo lectura: la
-- columna existe y las sesiones existentes tienen su provincia rellena. Había
-- que ejecutarlo ANTES de desplegar el cambio de /publicar: ese código envía el
-- campo provincia y el insert fallaría si la columna no existiera.
--
-- Cambio aditivo y sin riesgo: columna nullable, sin valor por defecto, sin
-- cambios en RLS, funciones ni índices. Las sesiones antiguas sin provincia
-- siguen funcionando: se encuentran por su ciudad, como hasta ahora.
-- ============================================================================

alter table public.clases
  add column if not exists provincia text;

comment on column public.clases.provincia is
  'Provincia (o comunidad autonoma uniprovincial) de la ciudad de la sesion, tal como la devuelve el autocompletado de ciudad de /publicar. Opcional: las sesiones antiguas no la tienen. Se usa solo para buscar por provincia en /clases.';

-- Relleno de las sesiones ya existentes (solo donde esta vacia). Para las
-- capitales que ya hay publicadas la provincia coincide con la ciudad, salvo
-- Bilbao (Vizcaya) y Madrid (Comunidad de Madrid), igual que lo da el
-- autocompletado.
update public.clases
set provincia = case ciudad
  when 'Bilbao' then 'Vizcaya'
  when 'Madrid' then 'Comunidad de Madrid'
  else ciudad
end
where provincia is null
  and ciudad in ('Sevilla', 'Málaga', 'Granada', 'Madrid', 'Valencia', 'Bilbao',
                 'Zaragoza', 'Córdoba', 'Alicante', 'Salamanca');

-- Comprobacion (solo lectura):
--   select ciudad, provincia, count(*) from public.clases group by 1, 2 order by 1;
