import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularReparto, eurosACentimos, formatearEuros } from './dinero.ts'

test('eurosACentimos convierte sin errores de coma flotante', () => {
  assert.equal(eurosACentimos(6), 600)
  assert.equal(eurosACentimos('6'), 600)
  assert.equal(eurosACentimos('6.5'), 650)
  assert.equal(eurosACentimos('6,50'), 650)
  // 0.1 + 0.2 = 0.30000000000000004 tiene más de 2 decimales: se rechaza en vez de redondear en silencio
  assert.throws(() => eurosACentimos(0.1 + 0.2), /Importe no válido/)
})

test('eurosACentimos rechaza importes no válidos', () => {
  for (const malo of ['', 'abc', '-1', '1.234', '1,2,3', ' ']) {
    assert.throws(() => eurosACentimos(malo), /Importe no válido/, `"${malo}"`)
  }
})

test('calcularReparto 10 %: casos exactos y redondeo', () => {
  assert.deepEqual(calcularReparto(1000, 1000), { importe: 1000, comision: 100, neto: 900 })
  assert.deepEqual(calcularReparto(600, 1000), { importe: 600, comision: 60, neto: 540 })
  assert.deepEqual(calcularReparto(999, 1000), { importe: 999, comision: 100, neto: 899 }) // 99,9 -> 100
  assert.deepEqual(calcularReparto(505, 1000), { importe: 505, comision: 51, neto: 454 }) // 50,5 -> 51 (mitad hacia arriba)
  assert.deepEqual(calcularReparto(504, 1000), { importe: 504, comision: 50, neto: 454 }) // 50,4 -> 50
  assert.deepEqual(calcularReparto(0, 1000), { importe: 0, comision: 0, neto: 0 })
})

test('calcularReparto: comisión y neto siempre suman el importe', () => {
  for (let importe = 0; importe <= 5000; importe += 7) {
    for (const bps of [0, 500, 1000, 1234, 10000]) {
      const r = calcularReparto(importe, bps)
      assert.equal(r.comision + r.neto, importe)
      assert.ok(r.comision >= 0 && r.neto >= 0)
    }
  }
})

test('calcularReparto rechaza entradas no válidas', () => {
  assert.throws(() => calcularReparto(10.5, 1000))
  assert.throws(() => calcularReparto(-1, 1000))
  assert.throws(() => calcularReparto(1000, -1))
  assert.throws(() => calcularReparto(1000, 10001))
  assert.throws(() => calcularReparto(1000, 10.5))
})

test('formatearEuros', () => {
  assert.equal(formatearEuros(1250), '12,50 €')
  assert.equal(formatearEuros(5), '0,05 €')
  assert.equal(formatearEuros(0), '0,00 €')
  assert.equal(formatearEuros(-250), '-2,50 €')
})
