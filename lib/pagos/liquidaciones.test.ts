import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ESTADOS_LINEA, MOTIVOS_EXCLUSION, esAccionLiquidacion } from './liquidaciones.ts'

const sql = readFileSync(new URL('../../sql/114_liquidaciones.sql', import.meta.url), 'utf8')

test('todos los motivos y estados del SQL tienen texto', () => {
  for (const motivo of Object.keys(MOTIVOS_EXCLUSION)) assert.ok(sql.includes(`'${motivo}'`), motivo)
  for (const estado of Object.keys(ESTADOS_LINEA)) assert.ok(sql.includes(`'${estado}'`), estado)
})

test('acciones permitidas', () => {
  for (const si of ['cerrar', 'pagada', 'anulada']) assert.equal(esAccionLiquidacion(si), true)
  for (const no of ['pendiente', '', null, undefined, 3]) assert.equal(esAccionLiquidacion(no), false)
})
