export const CATEGORIAS_FILTRO = [
  'Todas',
  'Fuerza / funcional',
  'Cardio',
  'Yoga / Pilates / movilidad',
  'Quedadas deportivas',
  'Otros',
]

export const FRANJAS_FILTRO = [
  { valor: 'Todas', etiqueta: 'Todas' },
  { valor: 'Mañana', etiqueta: 'Desde las 00:00 hasta las 13:59' },
  { valor: 'Tarde', etiqueta: 'Desde las 14:00 hasta las 18:59' },
  { valor: 'Noche', etiqueta: 'Desde las 19:00 hasta las 23:59' },
]

export const CUANDO_FILTRO = ['Todas', 'Hoy', 'Mañana', 'Próximos 7 días', 'Próximos 30 días']

function formatearFecha(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function obtenerFechaHoy() {
  return formatearFecha(new Date())
}

function sumarDias(fechaBase, dias) {
  const fecha = new Date(fechaBase + 'T00:00:00')
  fecha.setDate(fecha.getDate() + dias)
  return formatearFecha(fecha)
}

export function franjaDeHora(hora) {
  if (!hora) return null
  if (hora < '14:00') return 'Mañana'
  if (hora < '19:00') return 'Tarde'
  return 'Noche'
}

// Buscador por palabra: sin tildes ni mayúsculas, y todas las palabras
// escritas deben aparecer en alguna parte del título, tipo de actividad,
// categoría, observaciones o material (así "boxeo" encuentra "Entreno de
// boxeo y cardio" sin tener que elegir categoría).
function normalizarTexto(texto) {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function coincideConBusqueda(clase, busqueda) {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const texto = normalizarTexto(
    [clase.titulo, clase.tipo_actividad, clase.categoria, clase.observaciones, clase.material].join(' ')
  )
  return palabras.every((p) => texto.includes(p))
}

// Ciudad escrita a mano: sin tildes ni mayúsculas y por coincidencia parcial
// ("sev" encuentra Sevilla, "malaga" encuentra Málaga). Se busca en la ciudad
// y en la provincia de la sesión, así "Sevilla" encuentra también las de Dos
// Hermanas, Utrera... Vacío = todas.
export function coincideConCiudad(clase, textoCiudad) {
  const buscada = normalizarTexto(textoCiudad).trim()
  if (!buscada) return true
  return normalizarTexto(`${clase.ciudad} ${clase.provincia || ''}`).includes(buscada)
}

export function coincideConCuando(fechaClase, cuando, hoy) {
  if (cuando === 'Todas') return true
  if (cuando === 'Hoy') return fechaClase === hoy
  if (cuando === 'Mañana') return fechaClase === sumarDias(hoy, 1)
  if (cuando === 'Próximos 7 días') return fechaClase >= hoy && fechaClase <= sumarDias(hoy, 6)
  if (cuando === 'Próximos 30 días') return fechaClase >= hoy && fechaClase <= sumarDias(hoy, 29)
  return true
}

// ---- Precio, duración y plazas libres (N10) ----

// Rango que muestra la barra de precio. Sin tocar la barra NO hay restricción de precio (precioRango = null):
// salen también las sesiones de más de 50 €. Con un rango explícito, se aplican sus límites (ambos incluidos).
export const PRECIO_MINIMO = 0
export const PRECIO_MAXIMO = 50

// Las sesiones gratuitas tienen precio 0 (un precio vacío cuenta como gratuita).
export function coincideConPrecio(clase, precioRango) {
  if (!precioRango) return true
  const precio = Number(clase.precio ?? 0) || 0
  return precio >= precioRango.min && precio <= precioRango.max
}

export const DURACION_FILTRO = [
  { valor: 'Todas', etiqueta: 'Cualquier duración' },
  { valor: 'hasta30', etiqueta: 'Hasta 30 minutos' },
  { valor: '31a60', etiqueta: 'De 31 a 60 minutos' },
  { valor: '61a90', etiqueta: 'De 61 a 90 minutos' },
  { valor: 'mas90', etiqueta: 'Más de 90 minutos' },
]

// Con «Cualquier duración» entran todas, también las que no tienen duración informada; con un tramo elegido,
// solo las que tienen una duración real dentro de él.
export function coincideConDuracion(clase, tramo) {
  if (!tramo || tramo === 'Todas') return true
  const minutos = Number(clase.duracion)
  if (!(minutos > 0)) return false
  if (tramo === 'hasta30') return minutos <= 30
  if (tramo === '31a60') return minutos >= 31 && minutos <= 60
  if (tramo === '61a90') return minutos >= 61 && minutos <= 90
  if (tramo === 'mas90') return minutos > 90
  return true
}

// Plazas libres: no completa. (Las canceladas, inactivas y pasadas ya las descartan los filtros de siempre.)
export function tienePlazasLibres(clase) {
  if (clase.plazas_max == null) return true
  return (clase.plazas_ocupadas ?? 0) < clase.plazas_max
}

export function textoPrecioRango(precioRango) {
  if (!precioRango) return 'Cualquier precio'
  return `${precioRango.min} € – ${precioRango.max} €`
}
