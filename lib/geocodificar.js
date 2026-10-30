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


// Localiza UNA población (ciudad, pueblo...) escrita a mano, para ordenar las
// sesiones por cercanía cuando en esa ciudad no hay ninguna. Misma política de
// uso justo que geocodificar(): mínimo de caracteres, caché en memoria y el
// debounce lo hace quien llame. Devuelve { nombre, lat, lng } o null.
const cacheCiudades = new Map()

export async function geocodificarCiudad(texto, { signal } = {}) {
  const textoNormalizado = (texto ?? '').trim().toLowerCase()

  if (textoNormalizado.length < MINIMO_CARACTERES) {
    return null
  }

  if (cacheCiudades.has(textoNormalizado)) {
    return cacheCiudades.get(textoNormalizado)
  }

  const parametros = new URLSearchParams({
    q: texto,
    format: 'json',
    limit: '1',
    countrycodes: 'es',
    featuretype: 'settlement',
    'accept-language': 'es',
  })

  try {
    const respuesta = await fetch(`${URL_BASE}?${parametros.toString()}`, { signal })

    if (!respuesta.ok) {
      return null
    }

    const datos = await respuesta.json()
    const primero = datos[0]

    const resultado = primero
      ? {
          nombre: primero.name || primero.display_name.split(',')[0],
          lat: parseFloat(primero.lat),
          lng: parseFloat(primero.lon),
        }
      : null

    cacheCiudades.set(textoNormalizado, resultado)

    return resultado
  } catch (error) {
    return null
  }
}


// Autocompletado de ciudades para /publicar: hasta 5 poblaciones de España que
// encajan con lo escrito. Devuelve [{ nombre, detalle, lat, lng }]; "nombre" es
// el que se guarda como ciudad de la sesión (en español, tal cual lo da el
// servicio, para no acabar con "Sevilla" y "Seville" como ciudades distintas) y
// "detalle" (provincia/comunidad) solo sirve para distinguir homónimas en la lista.
const cacheBusquedaCiudades = new Map()

export async function buscarCiudades(texto, { signal } = {}) {
  const textoNormalizado = (texto ?? '').trim().toLowerCase()

  if (textoNormalizado.length < MINIMO_CARACTERES) {
    return []
  }

  if (cacheBusquedaCiudades.has(textoNormalizado)) {
    return cacheBusquedaCiudades.get(textoNormalizado)
  }

  const parametros = new URLSearchParams({
    q: texto,
    format: 'json',
    limit: '5',
    countrycodes: 'es',
    featuretype: 'settlement',
    'accept-language': 'es',
  })

  try {
    const respuesta = await fetch(`${URL_BASE}?${parametros.toString()}`, { signal })

    if (!respuesta.ok) {
      return []
    }

    const datos = await respuesta.json()
    const vistos = new Set()
    const ciudades = []

    // Se descartan provincias y regiones: solo interesan poblaciones.
    const NO_POBLACIONES = ['province', 'state', 'state_district', 'region', 'county', 'country']

    for (const resultado of datos) {
      if (NO_POBLACIONES.includes(resultado.addresstype)) continue
      const partes = resultado.display_name.split(',').map((p) => p.trim())
      const nombre = resultado.name || partes[0]
      const detalle = partes.slice(1, 3).join(', ')
      const clave = `${nombre}|${detalle}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      ciudades.push({ nombre, detalle, lat: parseFloat(resultado.lat), lng: parseFloat(resultado.lon) })
    }

    cacheBusquedaCiudades.set(textoNormalizado, ciudades)

    return ciudades
  } catch (error) {
    return []
  }
}
