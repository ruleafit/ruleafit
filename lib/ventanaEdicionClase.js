function obtenerAhoraMadridComoTexto() {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = formateador.formatToParts(new Date())
  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${obtener('year')}-${obtener('month')}-${obtener('day')} ${obtener('hour')}:${obtener('minute')}`
}

function obtenerPartesEnMadrid(momento) {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = formateador.formatToParts(momento)
  const obtener = (tipo) => Number(partes.find((p) => p.type === tipo)?.value)
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day'), hora: obtener('hour'), minuto: obtener('minute') }
}

function obtenerPartesAhoraMadrid() {
  return obtenerPartesEnMadrid(new Date())
}

export function claseYaPaso({ fecha, hora }) {
  if (!fecha || !hora) return false
  const horaCorta = String(hora).slice(0, 5)
  const inicioClase = `${fecha} ${horaCorta}`
  return inicioClase < obtenerAhoraMadridComoTexto()
}

export function horasHastaClase({ fecha, hora }) {
  if (!fecha || !hora) return null

  const [anioClase, mesClase, diaClase] = fecha.split('-').map(Number)
  const [horaClase, minutoClase] = String(hora).slice(0, 5).split(':').map(Number)
  const inicioMs = Date.UTC(anioClase, mesClase - 1, diaClase, horaClase, minutoClase)

  const ahora = obtenerPartesAhoraMadrid()
  const ahoraMs = Date.UTC(ahora.anio, ahora.mes - 1, ahora.dia, ahora.hora, ahora.minuto)

  return (inicioMs - ahoraMs) / (1000 * 60 * 60)
}

// Cuántas horas faltaban para el inicio de la clase en un instante concreto
// del pasado (p.ej. reservas.cancelled_at, la hora exacta en que el
// entrenador canceló la clase) — mismo criterio de "hora local de España"
// que horasHastaClase, pero respecto a ese instante en vez de respecto a
// ahora mismo. Usado para "valorar a un entrenador que canceló con menos de
// 2 horas de antelación" (sql/066_valorar_tras_cancelacion_tardia_entrenador.sql,
// pedido por el usuario el 2 de octubre de 2026).
export function horasAntesDeClase({ fecha, hora }, momentoIso) {
  if (!fecha || !hora || !momentoIso) return null

  const [anioClase, mesClase, diaClase] = fecha.split('-').map(Number)
  const [horaClase, minutoClase] = String(hora).slice(0, 5).split(':').map(Number)
  const inicioMs = Date.UTC(anioClase, mesClase - 1, diaClase, horaClase, minutoClase)

  const momento = obtenerPartesEnMadrid(new Date(momentoIso))
  const momentoMs = Date.UTC(momento.anio, momento.mes - 1, momento.dia, momento.hora, momento.minuto)

  return (inicioMs - momentoMs) / (1000 * 60 * 60)
}

export function motivoNoEditableClase(clase) {
  if (!clase) return 'Esta sesión no existe o no te pertenece.'
  if (clase.estado !== 'activa') return 'Esta sesión está cancelada y ya no se puede editar.'
  if (claseYaPaso(clase)) return 'Esta sesión ya ha pasado y no se puede editar.'

  const horas = horasHastaClase(clase)
  if (horas !== null && horas < 2) {
    return 'Faltan menos de 2 horas para el comienzo de esta sesión, así que ya no se puede editar.'
  }

  return null
}
