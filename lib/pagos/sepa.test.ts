import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generarPain001, importeSepa, ordenanteDesdeEntorno, textoSepa } from './sepa.ts'

// IBAN de ejemplo (dígitos de control correctos), no son cuentas reales.
const IBAN = 'ES9121000418450200051332'
const ordenante = { nombre: 'Ruleafit Pruebas S.L.', identificador: 'B00000000000', iban: IBAN }
const fichero = {
  referencia: 'RULEAFIT-20261215-0900-ABCDEF12',
  creado_en: '2026-12-15T08:00:00Z',
  transferencias: [
    { referencia: 'a'.repeat(32), titular: 'Rubén Núñez & Cía <SL>', iban: IBAN, importe_centimos: 1805, concepto: 'RULEAFIT liquidacion 15-12-2026', fecha_pago: '2026-12-15' },
    { referencia: 'b'.repeat(32), titular: 'Otra Persona', iban: IBAN, importe_centimos: 1000, concepto: 'RULEAFIT', fecha_pago: '2026-12-15' },
  ],
}

test('texto e importes en formato SEPA', () => {
  assert.equal(textoSepa('Rubén Núñez & Cía <SL>', 70), 'Ruben Nunez Cia SL')
  assert.equal(textoSepa('x'.repeat(80), 70).length, 70)
  assert.equal(importeSepa(1805), '18.05')
  assert.equal(importeSepa(5), '0.05')
  for (const mal of [0, -1, 1.5, NaN]) assert.throws(() => importeSepa(mal))
})

test('fichero: número, suma de control, fecha y caracteres', () => {
  const xml = generarPain001(ordenante, fichero, new Date('2026-12-10T10:00:00Z'))
  assert.match(xml, /pain\.001\.001\.03/)
  assert.equal(xml.match(/<NbOfTxs>2<\/NbOfTxs>/g)?.length, 2)
  assert.equal(xml.match(/<CtrlSum>28\.05<\/CtrlSum>/g)?.length, 2)
  assert.match(xml, /<ReqdExctnDt>2026-12-15<\/ReqdExctnDt>/)
  assert.ok(!xml.includes('&') && !xml.includes('<SL>'))
  assert.match(xml, /NOTPROVIDED/)
  // Nunca una fecha pasada.
  assert.match(generarPain001(ordenante, fichero, new Date('2026-12-20T10:00:00Z')), /<ReqdExctnDt>2026-12-20</)
  assert.match(generarPain001({ ...ordenante, bic: 'CAIXESBBXXX' }, fichero), /<BIC>CAIXESBBXXX<\/BIC>/)
})

test('no genera con datos malos', () => {
  assert.throws(() => generarPain001(ordenante, { ...fichero, transferencias: [] }))
  assert.throws(() => generarPain001(ordenante, { ...fichero, transferencias: [{ ...fichero.transferencias[0], iban: 'ES0000000000000000000000' }] }))
})

test('datos del ordenante', () => {
  assert.deepEqual(ordenanteDesdeEntorno({}), { faltan: ['SEPA_ORDENANTE_NOMBRE', 'SEPA_ORDENANTE_ID', 'SEPA_ORDENANTE_IBAN'] })
  const bien = ordenanteDesdeEntorno({ SEPA_ORDENANTE_NOMBRE: 'Ruleafit', SEPA_ORDENANTE_ID: 'B00000000000', SEPA_ORDENANTE_IBAN: 'ES91 2100 0418 4502 0005 1332' })
  assert.ok('ordenante' in bien && bien.ordenante.iban === IBAN)
})
