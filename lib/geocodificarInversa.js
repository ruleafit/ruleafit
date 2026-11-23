// Geocodificación INVERSA (N09): de un punto del mapa a su municipio y provincia, con el mismo servicio
// (Nominatim) y las mismas reglas de uso justo que lib/geocodificar.js: el formulario de publicar la
// llama con un retardo tras el último clic, cancela la petición anterior y las respuestas se guardan en
// caché por coordenadas redondeadas (≈ 11 m). Un fallo (red, límite, cancelación) devuelve null y nunca
// bloquea el formulario.

import { fetchNominatim } from './nominatim.js'

const URL_INVERSA = 'https://nominatim.openstreetmap.org/reverse'
const cacheInversa = new Map()

// Municipio y provincia a partir de la respuesta de Nominatim. Se devuelve el MUNICIPIO administrativo
// (nunca la provincia): barrios, distritos y pedanías (suburb, hamlet, neighbourhood…) se ignoran y se
// usa el municipio al que pertenecen. Si no consta municipio, null (la ciudad se escribirá a mano).
export function interpretarRespuestaInversa(datos) {
  const a = datos && datos.address
  if (!a || (a.country_code && String(a.country_code).toLowerCase() !== 'es')) return null
  const nombre = a.municipality || a.city || a.town || a.village
  if (!nombre) return null
  return { nombre: String(nombre).trim(), provincia: String(a.province || a.county || a.state || '').trim() }
}

// Dirección postal «Calle, número» si el servicio la da (para guardarla con una ubicación habitual).
export function direccionFisicaDe(datos) {
  const a = (datos && datos.address) || {}
  const calle = a.road || a.pedestrian || a.footway || a.path || ''
  if (!calle) return ''
  return a.house_number ? `${calle}, ${a.house_number}` : String(calle)
}

async function consultarInversa(lat, lng, zoom, signal) {
  const clave = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)},${zoom}`
  if (cacheInversa.has(clave)) return cacheInversa.get(clave)
  const parametros = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    zoom: String(zoom),
    addressdetails: '1',
    'accept-language': 'es',
  })
  try {
    const respuesta = await fetchNominatim(`${URL_INVERSA}?${parametros.toString()}`, { signal })
    if (!respuesta.ok) return null
    const datos = await respuesta.json()
    if (!datos || datos.error) return null
    cacheInversa.set(clave, datos)
    return datos
  } catch (error) {
    return null
  }
}

// { nombre, provincia } del municipio donde cae el punto, o null si no se ha podido saber.
export async function geocodificarInversa(lat, lng, { signal } = {}) {
  return interpretarRespuestaInversa(await consultarInversa(lat, lng, 10, signal))
}

// Dirección postal aproximada del punto (calle y número), o '' si no consta.
export async function direccionDePunto(lat, lng, { signal } = {}) {
  return direccionFisicaDe(await consultarInversa(lat, lng, 18, signal))
}
