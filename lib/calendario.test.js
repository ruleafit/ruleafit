import test from 'node:test'
import assert from 'node:assert/strict'
import {
  eventoDeSesion, urlGoogleCalendar, generarIcs, plegarLineaIcs, escaparTextoIcs, sumarMinutos, nombreArchivoIcs,
} from './calendario.js'

const sesion = (o = {}) => ({
  id: '11111111-2222-3333-4444-555555555555', titulo: 'Funcional con barra', fecha: '2026-11-24', hora: '18:30:00', duracion: 45,
  ciudad: 'Sevilla', direccion: 'Calle Ñandú, 5', punto_encuentro: 'Puerta del parque', perfiles: { username: 'gimnasio_ana' }, ...o,
})
const desplegar = (ics) => ics.replace(/\r\n /g, '')
const prop = (ics, nombre) => desplegar(ics).slice(desplegar(ics).indexOf('BEGIN:VEVENT')).split('\r\n').find((l) => l.startsWith(nombre + ':') || l.startsWith(nombre + ';'))

test('evento: título, hora de fin con la duración real, ubicación y descripción', () => {
  const e = eventoDeSesion(sesion())
  assert.equal(e.titulo, 'RuleaFit · Funcional con barra')
  assert.deepEqual(e.inicio, { fecha: '2026-11-24', hora: '18:30' })
  assert.deepEqual(e.fin, { fecha: '2026-11-24', hora: '19:15' })
  assert.equal(e.ubicacion, 'Calle Ñandú, 5, Sevilla · Punto de encuentro: Puerta del parque')
  assert.match(e.descripcion, /Sesión reservada en RuleaFit\./)
  assert.match(e.descripcion, /Organizador: @gimnasio_ana/)
  assert.match(e.descripcion, /https:\/\/www\.ruleafit\.com\/clases\/11111111-2222-3333-4444-555555555555/)
  assert.match(e.descripcion, /cambios o cancelaciones/)
})

test('fin cruzando medianoche y duración por defecto', () => {
  assert.deepEqual(sumarMinutos('2026-12-31', '23:30', 60), { fecha: '2027-01-01', hora: '00:30' })
  assert.deepEqual(eventoDeSesion(sesion({ hora: '23:30', duracion: 90, fecha: '2026-02-28' })).fin, { fecha: '2026-03-01', hora: '01:00' })
  assert.deepEqual(eventoDeSesion(sesion({ duracion: null })).fin, { fecha: '2026-11-24', hora: '19:30' })
})

test('sin punto de encuentro ni organizador no inventa datos', () => {
  const e = eventoDeSesion(sesion({ punto_encuentro: '', perfiles: null }))
  assert.equal(e.ubicacion, 'Calle Ñandú, 5, Sevilla')
  assert.ok(!e.descripcion.includes('Organizador'))
})

test('Google Calendar: todos los datos y zona Europe/Madrid', () => {
  const u = new URL(urlGoogleCalendar(eventoDeSesion(sesion())))
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render')
  assert.equal(u.searchParams.get('action'), 'TEMPLATE')
  assert.equal(u.searchParams.get('text'), 'RuleaFit · Funcional con barra')
  assert.equal(u.searchParams.get('dates'), '20261124T183000/20261124T191500')
  assert.equal(u.searchParams.get('ctz'), 'Europe/Madrid')
  assert.match(u.searchParams.get('location'), /Ñandú/)
  assert.match(u.searchParams.get('details'), /Organizador: @gimnasio_ana/)
})

test('Google Calendar: los datos del usuario no pueden añadir parámetros ni cambiar la dirección', () => {
  const malo = sesion({ titulo: 'X&details=HACK&action=OTRA#frag\r\nBEGIN:VEVENT', direccion: 'a=b&c=d?e#f', perfiles: { username: 'u&ctz=UTC' } })
  const url = urlGoogleCalendar(eventoDeSesion(malo))
  const u = new URL(url)
  assert.equal(u.host, 'calendar.google.com')
  assert.deepEqual([...u.searchParams.keys()].sort(), ['action', 'ctz', 'dates', 'details', 'location', 'text'])
  assert.equal(u.searchParams.get('action'), 'TEMPLATE')
  assert.equal(u.searchParams.get('ctz'), 'Europe/Madrid')
  assert.ok(u.searchParams.get('text').includes('X&details=HACK&action=OTRA#frag BEGIN:VEVENT')) // texto literal, una sola línea
  assert.equal(u.hash, '')
})

test('.ics válido: estructura, CRLF, zona, fechas locales y campos', () => {
  const ics = generarIcs(eventoDeSesion(sesion()), new Date('2026-11-20T10:11:12Z'))
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(ics), 'solo saltos CRLF')
  const lineas = desplegar(ics).split('\r\n').filter(Boolean)
  const abre = lineas.filter((l) => l.startsWith('BEGIN:')), cierra = lineas.filter((l) => l.startsWith('END:'))
  assert.deepEqual(abre.map((l) => l.slice(6)).sort(), cierra.map((l) => l.slice(4)).sort())
  assert.ok(lineas.includes('VERSION:2.0') && lineas.some((l) => l.startsWith('PRODID:')))
  assert.equal(prop(ics, 'DTSTART'), 'DTSTART;TZID=Europe/Madrid:20261124T183000')
  assert.equal(prop(ics, 'DTEND'), 'DTEND;TZID=Europe/Madrid:20261124T191500')
  assert.equal(prop(ics, 'DTSTAMP'), 'DTSTAMP:20261120T101112Z')
  assert.equal(prop(ics, 'UID'), 'UID:11111111-2222-3333-4444-555555555555-20261124@ruleafit.com')
  assert.equal(prop(ics, 'SUMMARY'), 'SUMMARY:RuleaFit · Funcional con barra')
  assert.match(prop(ics, 'LOCATION'), /Calle Ñandú\\, 5\\, Sevilla · Punto de encuentro: Puerta del parque/)
  assert.match(prop(ics, 'DESCRIPTION'), /Sesión reservada en RuleaFit\.\\nOrganizador: @gimnasio_ana\\nFicha de la sesión: https:\/\/www\.ruleafit\.com\/clases\//)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1, 'solo la fecha reservada')
})

test('.ics: zona Europe/Madrid con reglas de verano e invierno y horas de reloj en marzo y octubre', () => {
  const ics = generarIcs(eventoDeSesion(sesion({ fecha: '2026-03-29', hora: '10:00' })))
  assert.match(ics, /BEGIN:DAYLIGHT\r\nTZOFFSETFROM:\+0100\r\nTZOFFSETTO:\+0200\r\nTZNAME:CEST\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU/)
  assert.match(ics, /BEGIN:STANDARD\r\nTZOFFSETFROM:\+0200\r\nTZOFFSETTO:\+0100\r\nTZNAME:CET\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU/)
  assert.equal(prop(ics, 'DTSTART'), 'DTSTART;TZID=Europe/Madrid:20260329T100000')
  const octubre = generarIcs(eventoDeSesion(sesion({ fecha: '2026-10-25', hora: '09:00', duracion: 60 })))
  assert.equal(prop(octubre, 'DTSTART'), 'DTSTART;TZID=Europe/Madrid:20261025T090000')
  assert.equal(prop(octubre, 'DTEND'), 'DTEND;TZID=Europe/Madrid:20261025T100000')
  const verano = generarIcs(eventoDeSesion(sesion({ fecha: '2026-07-15', hora: '19:00', duracion: 60 })))
  assert.equal(prop(verano, 'DTSTART'), 'DTSTART;TZID=Europe/Madrid:20260715T190000')
})

test('.ics: escapado de coma, punto y coma, barra y saltos; plegado a 75 octetos sin partir tildes', () => {
  assert.equal(escaparTextoIcs('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne')
  const largo = 'Ñandú ' + 'áéíóú ñ€ 😀 '.repeat(30)
  const plegada = plegarLineaIcs('DESCRIPTION:' + largo)
  const enc = new TextEncoder()
  for (const l of plegada.split('\r\n')) assert.ok(enc.encode(l).length <= 75, `línea de ${enc.encode(l).length} octetos`)
  assert.equal(plegada.replace(/\r\n /g, ''), 'DESCRIPTION:' + largo) // al desplegar queda idéntica
  assert.ok(!plegada.includes('�'))
})

test('nombre de archivo sin tildes ni caracteres raros', () => {
  assert.equal(nombreArchivoIcs(eventoDeSesion(sesion({ titulo: 'Yoga ¡Ñandú! / Pilates' }))), 'ruleafit-yoga-nandu-pilates-2026-11-24.ics')
})

test('sesión recurrente: cada fecha reservada genera su propio evento (UID distinto, una sola fecha)', () => {
  const a = generarIcs(eventoDeSesion(sesion({ id: 'aaaa', fecha: '2026-12-01' })))
  const b = generarIcs(eventoDeSesion(sesion({ id: 'bbbb', fecha: '2026-12-08' })))
  assert.notEqual(prop(a, 'UID'), prop(b, 'UID'))
  assert.equal((a.match(/BEGIN:VEVENT/g) || []).length, 1)
})
