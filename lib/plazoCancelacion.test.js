import test from 'node:test'
import assert from 'node:assert/strict'
import { plazoCancelacion } from './plazoCancelacion.js'

// Instantes en UTC; en noviembre Madrid = UTC+1, en agosto = UTC+2.
const clase = { fecha: '2026-11-24', hora: '18:30:00' } // límite: 24/11 16:30 (Madrid)

test('muestra el límite 2 h antes del inicio', () => {
  const p = plazoCancelacion(clase, new Date('2026-11-20T10:00:00Z'))
  assert.equal(p.estado, 'abierto')
  assert.deepEqual(p.limite, { dia: '24/11', hora: '16:30' })
})

test('exactamente 2 h antes todavía se puede cancelar (como el servidor)', () => {
  // 16:30 Madrid = 15:30 UTC
  assert.equal(plazoCancelacion(clase, new Date('2026-11-24T15:30:00Z')).estado, 'abierto')
})

test('un segundo después del límite ya no', () => {
  assert.equal(plazoCancelacion(clase, new Date('2026-11-24T15:30:01Z')).estado, 'cerrado')
})

test('menos de 2 h y sesión ya empezada', () => {
  assert.equal(plazoCancelacion(clase, new Date('2026-11-24T16:30:00Z')).yaEmpezada, false) // 17:30 Madrid
  const t = plazoCancelacion(clase, new Date('2026-11-24T17:45:00Z')) // 18:45 Madrid
  assert.equal(t.estado, 'cerrado')
  assert.equal(t.yaEmpezada, true)
})

test('sesión de madrugada: el límite cae el día anterior', () => {
  const p = plazoCancelacion({ fecha: '2026-11-24', hora: '01:00' }, new Date('2026-11-20T10:00:00Z'))
  assert.deepEqual(p.limite, { dia: '23/11', hora: '23:00' })
})

test('verano (UTC+2) y cambio de mes', () => {
  const c = { fecha: '2026-09-01', hora: '09:00' }
  const p = plazoCancelacion(c, new Date('2026-08-31T05:00:00Z')) // 07:00 Madrid
  assert.deepEqual(p.limite, { dia: '01/09', hora: '07:00' })
  assert.equal(p.estado, 'abierto')
  assert.equal(plazoCancelacion(c, new Date('2026-09-01T07:00:01Z')).estado, 'cerrado') // 09:00:01 -> ya empezó
})

test('sin datos no inventa un plazo', () => {
  assert.equal(plazoCancelacion({ fecha: null, hora: null }).estado, 'desconocido')
})
