import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BLOQUEOS_FACTURA, htmlFactura, type Factura } from './facturas.ts'

const base: Factura = {
  tipo: 'comision',
  estado: 'borrador',
  numero: null,
  emisor: { nombre: 'Ruleafit', nif: 'B00000000', direccion: 'Calle 1' },
  receptor: { nombre: '<script>x</script>' },
  concepto: 'Comisión',
  fecha_operacion: '2026-12-15',
  base_centimos: 826,
  iva_bps: 2100,
  iva_centimos: 174,
  total_centimos: 1000,
  detalle: [{ concepto: 'Sesión', cobrado_centimos: 10000, comision_centimos: 1000 }],
}

test('el borrador avisa, escapa los datos y solo factura la comisión', () => {
  const h = htmlFactura(base)
  assert.match(h, /BORRADOR SIN VALIDEZ FISCAL/)
  assert.ok(!h.includes('<script>x'))
  assert.match(h, /<strong>10,00/)
  assert.match(h, /en nombre y por cuenta del destinatario/)
  assert.ok(!/destinatario: emitida|IRPF/.test(h))
})

test('una emitida lleva número y no el aviso', () => {
  const h = htmlFactura({ ...base, tipo: 'pro', estado: 'emitida', numero: 'PRO-2026-000001', detalle: [] })
  assert.match(h, /PRO-2026-000001/)
  assert.ok(!h.includes('BORRADOR') && !h.includes('Reservas incluidas'))
})

test('todos los bloqueos del SQL tienen texto', () => {
  const sql = readFileSync(new URL('../../sql/116_facturas.sql', import.meta.url), 'utf8')
  for (const b of Object.keys(BLOQUEOS_FACTURA)) assert.ok(sql.includes(`'${b}'`), b)
})

test('la base de datos no genera autofacturas ni facturas por el total', () => {
  const sql = readFileSync(new URL('../../sql/116_facturas.sql', import.meta.url), 'utf8')
  assert.ok(!/'autofactura'|irpf/i.test(sql))
})
