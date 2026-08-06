// Geocodificación de direcciones mediante Nominatim (OpenStreetMap), limitada a España.
// Nominatim es un servicio público gratuito con uso justo ("fair use"): sin límite de
// peticiones por segundo estricto, pero exige no abusar (por eso el mínimo de caracteres,
// el caché en memoria y el debounce en quien llame a esta función) e identificar la app
// que consume la API. Política de uso: https://operations.osmfoundation.org/policies/nominatim/

const URL_BASE = 'https://nominatim.openstreetmap.org/search'
const MINIMO_CARACTERES = 4

const cache = new Map()

export async function geocodificar(texto, { signal } = {}) {
  const textoNormalizado = (texto ?? '').trim().toLowerCase()

  if (textoNormalizado.length < MINIMO_CARACTERES) {
    return []
  }

  if (cache.has(textoNormalizado)) {
    return cache.get(textoNormalizado)
  }

  const parametros = new URLSearchParams({
    q: texto,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'es',
    'accept-language': 'es',
  })

  try {
    const respuesta = await fetch(`${URL_BASE}?${parametros.toString()}`, { signal })

    if (!respuesta.ok) {
      return []
    }

    const datos = await respuesta.json()

    const sugerencias = datos.map((resultado) => ({
      nombre: resultado.display_name,
      lat: parseFloat(resultado.lat),
      lng: parseFloat(resultado.lon),
    }))

    cache.set(textoNormalizado, sugerencias)

    return sugerencias
  } catch (error) {
    if (error.name === 'AbortError') {
      return []
    }

    return []
  }
}
