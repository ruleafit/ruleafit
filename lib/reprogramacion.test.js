import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HORAS_CON_RESERVAS, HORAS_SIN_RESERVAS, cambiosDeSesion, errorDeReprogramacion } from './reprogramacion.js'

const base = { fecha: '2026-12-10', hora: '10:00:00', ciudad: 'Sevilla', provincia: 'Sevilla', direccion: 'Pista 1', lat: 37.38, lng: -5.98 }
const ahora = new Date('2026-12-01T09:00:00Z')

test('cambiosDeSesion: solo lo que cambia', () => {
  assert.deepEqual(cambiosDeSesion(base, { ...base, hora: '10:00' }), [])
  assert.deepEqual(cambiosDeSesion(base, { ...base, hora: '12:00:00' }), [{ campo: 'Hora', antes: '10:00', despues: '12:00' }])
  const lugar = cambiosDeSesion(base, { ...base, ciudad: 'Camas', direccion: null })
  assert.equal(lugar.length, 1)
  assert.equal(lugar[0].antes, 'Pista 1, Sevilla')
  assert.equal(lugar[0].despues, 'Camas, Sevilla')
  assert.match(cambiosDeSesion(base, { ...base, lat: 37.39 })[0].despues, /otro punto del mapa/)
  assert.equal(cambiosDeSesion(base, { ...base, fecha: '2026-12-11' })[0].campo, 'Fecha')
})

test('errorDeReprogramacion', () => {
  const pedir = (nueva, extra = {}) =>
    errorDeReprogramacion({ actual: base, nueva: { ...base, ...nueva }, hayCambioDeLugar: false, conReservas: true, ...extra }, ahora)
  assert.equal(pedir({ hora: '12:00' }), null)
  assert.match(pedir({}), /ningún cambio/)
  assert.equal(pedir({}, { hayCambioDeLugar: true }), null)
  assert.match(pedir({ fecha: '' }), /fecha y la hora/)
  assert.match(pedir({ fecha: '2026-12-01', hora: '20:00' }), /24 horas/)
  assert.equal(pedir({ fecha: '2026-12-01', hora: '20:00' }, { conReservas: false }), null)
})

test('los márgenes coinciden con la base de datos', () => {
  const sql = readFileSync(new URL('../sql/100_reprogramaciones.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes(`then interval '${HORAS_CON_RESERVAS} hours' else interval '${HORAS_SIN_RESERVAS} hours'`))
})
