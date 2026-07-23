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

function obtenerPartesAhoraMadrid() {
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
  const obtener = (tipo) => Number(partes.find((p) => p.type === tipo)?.value)
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day'), hora: obtener('hour'), minuto: obtener('minute') }
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

export function motivoNoEditableClase(clase) {
  if (!clase) return 'Esta clase no existe o no te pertenece.'
  if (clase.estado !== 'activa') return 'Esta clase está cancelada y ya no se puede editar.'
  if (claseYaPaso(clase)) return 'Esta clase ya ha pasado y no se puede editar.'

  const horas = horasHastaClase(clase)
  if (horas !== null && horas < 2) {
    return 'Faltan menos de 2 horas para el comienzo de esta clase, así que ya no se puede editar.'
  }

  return null
}
