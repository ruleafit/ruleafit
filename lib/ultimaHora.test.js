import test from 'node:test'
import assert from 'node:assert/strict'
import { esReservaDeUltimaHora } from './ultimaHora.js'

// Sesión el 2026-12-10 a las 18:00 (hora de Madrid, CET = UTC+1 → 17:00 UTC).
const clase = { fecha: '2026-12-10', hora: '18:00:00' }
const en = (minutosAntes, seg = 0) => new Date(Date.UTC(2026, 11, 10, 17, 0, 0) - (minutosAntes * 60 - seg) * 1000)

test('31 minutos: sin aviso', () => assert.equal(esReservaDeUltimaHora(clase, en(31)), false))
test('exactamente 30 minutos: sin aviso', () => assert.equal(esReservaDeUltimaHora(clase, en(30)), false))
test('29 minutos 59 s: con aviso', () => assert.equal(esReservaDeUltimaHora(clase, en(30, 1)), true))
test('29, 15, 5 y 1 minuto: con aviso', () => {
  for (const m of [29, 15, 5, 1]) assert.equal(esReservaDeUltimaHora(clase, en(m)), true, String(m))
})
test('sesión que ya ha empezado (o justo ahora): sin aviso, se mantienen las restricciones habituales', () => {
  assert.equal(esReservaDeUltimaHora(clase, en(0)), false)
  assert.equal(esReservaDeUltimaHora(clase, en(-1)), false)
  assert.equal(esReservaDeUltimaHora(clase, en(-120)), false)
})
test('sin fecha/hora: sin aviso', () => assert.equal(esReservaDeUltimaHora({}, new Date()), false))
test('zona horaria: correcto en horario de verano (CEST = UTC+2) y en cambio de hora', () => {
  const verano = { fecha: '2026-07-10', hora: '18:00' } // 16:00 UTC
  const base = Date.UTC(2026, 6, 10, 16, 0, 0)
  assert.equal(esReservaDeUltimaHora(verano, new Date(base - 29 * 60000)), true)
  assert.equal(esReservaDeUltimaHora(verano, new Date(base - 31 * 60000)), false)
  // el servidor del usuario puede estar en otra zona: el cálculo no depende del reloj local de la máquina
  const cambio = { fecha: '2026-10-25', hora: '09:00' } // ya CET (UTC+1) → 08:00 UTC
  assert.equal(esReservaDeUltimaHora(cambio, new Date(Date.UTC(2026, 9, 25, 8, 0, 0) - 10 * 60000)), true)
})
