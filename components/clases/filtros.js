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
