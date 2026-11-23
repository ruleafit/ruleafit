// Añadir una sesión reservada al calendario personal (C02). Funciones puras, sin React ni Supabase.
//
// Dos salidas, sin pedir permisos a ningún calendario ni usar APIs privadas:
//   · enlace de Google Calendar con el evento ya preparado (el usuario lo confirma);
//   · archivo .ics (iCalendar, RFC 5545) para Apple Calendar, Outlook y demás.
// No hay sincronización: si la sesión cambia o se cancela, RuleaFit sigue siendo la fuente de información
// (el evento lo recuerda en su descripción y lleva el enlace a la ficha).
//
// Fechas y horas: 'YYYY-MM-DD' y 'HH:MM' en hora local de España (Europe/Madrid), tal cual se guardan.
// El evento se declara con la zona Europe/Madrid (en el .ics con su VTIMEZONE de verano/invierno, en
// Google con ctz), así que el cambio de horario lo resuelve el propio calendario; la hora de fin se calcula
// sumando la duración sobre la hora «de reloj» de inicio.

export const URL_BASE = 'https://www.ruleafit.com'
export const ZONA = 'Europe/Madrid'
// Si la sesión no tiene duración informada, el evento dura una hora.
export const DURACION_POR_DEFECTO = 60

const dos = (n) => String(n).padStart(2, '0')

// Texto de una sola línea (sin saltos ni caracteres de control) para título y ubicación.
function linea(t) {
  return String(t ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Inicio + minutos sobre el calendario «de reloj»: { fecha: 'YYYY-MM-DD', hora: 'HH:MM' }.
export function sumarMinutos(fecha, hora, minutos) {
  const [a, m, d] = String(fecha).split('-').map(Number)
  const [h, mi] = String(hora).slice(0, 5).split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, h, mi + minutos))
  return {
    fecha: `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}`,
    hora: `${dos(t.getUTCHours())}:${dos(t.getUTCMinutes())}`,
  }
}

// 'YYYYMMDDTHHMMSS' (hora local, sin zona) a partir de fecha y hora.
export function formatoLocal(fecha, hora) {
  return `${String(fecha).replace(/-/g, '')}T${String(hora).slice(0, 5).replace(':', '')}00`
}

// Datos del evento a partir de una sesión (fila de `clases` con `perfiles(username)`).
export function eventoDeSesion(clase) {
  const hora = String(clase.hora).slice(0, 5)
  const dur = Number(clase.duracion) > 0 ? Math.round(Number(clase.duracion)) : DURACION_POR_DEFECTO
  const fin = sumarMinutos(clase.fecha, hora, dur)

  const direccion = [linea(clase.direccion), linea(clase.ciudad)].filter(Boolean).join(', ')
  const punto = linea(clase.punto_encuentro)
  const ubicacion = [direccion, punto ? `Punto de encuentro: ${punto}` : ''].filter(Boolean).join(' · ')

  const url = `${URL_BASE}/clases/${encodeURIComponent(String(clase.id))}`
  const organizador = linea(clase.perfiles?.username)
  const descripcion = [
    'Sesión reservada en RuleaFit.',
    organizador ? `Organizador: @${organizador}` : '',
    `Ficha de la sesión: ${url}`,
    'Consulta RuleaFit por si hay cambios o cancelaciones: la ficha de la sesión es la información actualizada.',
  ].filter(Boolean).join('\n')

  return {
    id: String(clase.id),
    titulo: `RuleaFit · ${linea(clase.titulo) || 'Sesión'}`,
    inicio: { fecha: clase.fecha, hora },
    fin,
    ubicacion,
    descripcion,
    url,
  }
}

// Enlace de Google Calendar con el evento preparado. Todo valor se codifica con URLSearchParams, así que
// ningún dato de la sesión puede añadir parámetros ni alterar la dirección. No pide permisos de cuenta.
export function urlGoogleCalendar(evento) {
  const p = new URLSearchParams()
  p.set('action', 'TEMPLATE')
  p.set('text', evento.titulo)
  p.set('dates', `${formatoLocal(evento.inicio.fecha, evento.inicio.hora)}/${formatoLocal(evento.fin.fecha, evento.fin.hora)}`)
  p.set('ctz', ZONA)
  if (evento.ubicacion) p.set('location', evento.ubicacion)
  p.set('details', evento.descripcion)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

// ---- iCalendar (.ics) ----

// Escapado de valores TEXT (RFC 5545 §3.3.11): barra, punto y coma, coma y saltos de línea.
export function escaparTextoIcs(t) {
  return String(t ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Pliega una línea a un máximo de 75 octetos UTF-8 (sin partir caracteres); las continuaciones llevan un espacio.
export function plegarLineaIcs(linea) {
  const enc = new TextEncoder()
  if (enc.encode(linea).length <= 75) return linea
  const partes = []
  let actual = ''
  let bytes = 0
  let limite = 75
  for (const ch of linea) {
    const b = enc.encode(ch).length
    if (bytes + b > limite) {
      partes.push(actual)
      actual = ''
      bytes = 0
      limite = 74 // el espacio inicial de la continuación ocupa un octeto
    }
    actual += ch
    bytes += b
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

function sello(ahora) {
  const d = ahora
  return `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`
}

// Contenido del archivo .ics (un único evento, solo la fecha reservada). `ahora` permite probarlo.
export function generarIcs(evento, ahora = new Date()) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RuleaFit//Sesiones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Zona Europe/Madrid con las reglas de verano (último domingo de marzo) e invierno (último de octubre).
    'BEGIN:VTIMEZONE',
    `TZID:${ZONA}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${evento.id}-${evento.inicio.fecha.replace(/-/g, '')}@ruleafit.com`,
    `DTSTAMP:${sello(ahora)}`,
    `DTSTART;TZID=${ZONA}:${formatoLocal(evento.inicio.fecha, evento.inicio.hora)}`,
    `DTEND;TZID=${ZONA}:${formatoLocal(evento.fin.fecha, evento.fin.hora)}`,
    `SUMMARY:${escaparTextoIcs(evento.titulo)}`,
    ...(evento.ubicacion ? [`LOCATION:${escaparTextoIcs(evento.ubicacion)}`] : []),
    `DESCRIPTION:${escaparTextoIcs(evento.descripcion)}`,
    `URL:${evento.url}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lineas.map(plegarLineaIcs).join('\r\n') + '\r\n'
}

// Nombre de archivo seguro: sin tildes ni caracteres raros.
export function nombreArchivoIcs(evento) {
  const base = evento.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return `${base || 'ruleafit-sesion'}-${evento.inicio.fecha}.ics`
}
