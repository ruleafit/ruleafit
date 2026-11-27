import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ESTADOS_INCIDENCIA,
  MAX_DESCRIPCION,
  MIN_DESCRIPCION,
  TIPOS_INCIDENCIA,
  errorDeIncidencia,
  esEstadoIncidencia,
  esTipoIncidencia,
  estaCerrada,
  puedeDevolver,
} from './incidencias.ts'

const sql = readFileSync(new URL('../../sql/098_incidencias_pago.sql', import.meta.url), 'utf8')

test('motivos y estados coinciden con la base de datos', () => {
  const lista = (v: object) => Object.keys(v).map((k) => `'${k}'`).join(', ')
  assert.ok(sql.includes(`check (tipo in (${lista(TIPOS_INCIDENCIA)}))`))
  assert.ok(sql.includes(`check (estado in (${lista(ESTADOS_INCIDENCIA)}))`))
  assert.ok(sql.includes(`between ${MIN_DESCRIPCION} and ${MAX_DESCRIPCION}`))
})

test('errorDeIncidencia', () => {
  assert.equal(errorDeIncidencia('r1', 'cobro', 'Me han cobrado dos veces'), null)
  assert.match(errorDeIncidencia('', 'cobro', 'Me han cobrado dos veces')!, /reserva/)
  assert.match(errorDeIncidencia('r1', 'otro', 'Me han cobrado dos veces')!, /motivo/)
  assert.match(errorDeIncidencia('r1', 'cobro', '   corto    ')!, /caracteres/)
  assert.match(errorDeIncidencia('r1', 'cobro', 'x'.repeat(MAX_DESCRIPCION + 1))!, /caracteres/)
})

test('no se aceptan claves heredadas de Object', () => {
  assert.equal(esTipoIncidencia('toString'), false)
  assert.equal(esEstadoIncidencia('constructor'), false)
  assert.equal(estaCerrada('resuelta'), true)
  assert.equal(estaCerrada('en_revision'), false)
})

test('«Devolver y cerrar» solo con un pago cobrado y no devuelto', () => {
  assert.equal(puedeDevolver('pagado'), true)
  assert.equal(puedeDevolver('requiere_reembolso'), true)
  for (const no of ['reembolsado', 'fallido', 'creado', 'caducado', undefined, null]) assert.equal(puedeDevolver(no), false, String(no))
})
