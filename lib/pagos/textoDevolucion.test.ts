import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BONO_DEVUELTO, DEVOLUCION_COMPLETADA, DEVOLUCION_EN_MARCHA, estadoDevolucionCaso, mensajeCancelacion, textoDevolucion } from './textoDevolucion.ts'

test('texto según el estado real del cobro', () => {
  assert.equal(textoDevolucion('requiere_reembolso'), DEVOLUCION_EN_MARCHA)
  assert.equal(textoDevolucion('reembolsado'), DEVOLUCION_COMPLETADA)
  assert.equal(textoDevolucion(undefined, true), BONO_DEVUELTO)
  for (const sin of [undefined, null, 'pagado', 'fallido', 'caducado']) assert.equal(textoDevolucion(sin), null, String(sin))
})

test('mensaje tras cancelar', () => {
  assert.match(mensajeCancelacion({ cancelacion_tardia: false, reembolso: 'pendiente' }), /tramitado automáticamente/)
  assert.match(mensajeCancelacion({ usaba_bono: true }), /vuelve a estar disponible/)
  assert.equal(mensajeCancelacion({ cancelacion_tardia: false, reembolso: null }), 'Reserva cancelada correctamente.')
  assert.equal(mensajeCancelacion(null), 'Reserva cancelada correctamente.')
})

test('una cancelación tardía nunca promete devolución', () => {
  for (const r of [
    { cancelacion_tardia: true, reembolso: 'sin_derecho' },
    { cancelacion_tardia: true, usaba_bono: true },
    { cancelacion_tardia: true },
  ]) {
    assert.ok(!/tramitado|disponible/.test(mensajeCancelacion(r)), JSON.stringify(r))
  }
})

test('estado de la devolución en una reclamación', () => {
  const tramite = estadoDevolucionCaso({ estado: 'requiere_reembolso', importe_centimos: 755 })
  assert.equal(tramite?.hecha, false)
  assert.match(tramite!.texto, /7,55.*en trámite/)
  // Bono: se enseña la parte que se devuelve, no lo pagado.
  const parcial = estadoDevolucionCaso({ estado: 'reembolsado_parcial', importe_centimos: 4000, importe_devolver_centimos: 3000 })
  assert.equal(parcial?.hecha, true)
  assert.match(parcial!.texto, /30,00.*confirmada/)
  for (const estado of ['pagado', 'fallido', 'caducado', 'creado']) assert.equal(estadoDevolucionCaso({ estado }), null, estado)
  assert.equal(estadoDevolucionCaso(null), null)
})
