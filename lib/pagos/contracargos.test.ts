import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importeEnCentimos, validarAlta } from './contracargos.ts'

test('importe del contracargo: euros con coma o punto, vacío = todo', () => {
  assert.equal(importeEnCentimos('12,50'), 1250)
  assert.equal(importeEnCentimos('12.5'), 1250)
  assert.equal(importeEnCentimos('7'), 700)
  assert.equal(importeEnCentimos(''), null)
  for (const malo of ['0', '-3', '1.234,50', '12,505', 'doce']) assert.equal(importeEnCentimos(malo), undefined, malo)
})

test('alta de contracargo: pedido obligatorio y fecha real', () => {
  assert.deepEqual(validarAlta({ pedido: ' 261200000001 ', importe: '', referencia: '', fechaLimite: '2026-12-10' }), {
    datos: { p_pedido: '261200000001', p_importe_centimos: null, p_referencia: null, p_motivo: null, p_fecha_limite: '2026-12-10' },
  })
  for (const malo of [{}, { pedido: 'abc' }, { pedido: '2612', importe: 'x' }, { pedido: '2612', fechaLimite: '2026-02-31' }]) {
    assert.ok('error' in validarAlta(malo), JSON.stringify(malo))
  }
})
