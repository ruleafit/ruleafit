import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SALDOS, SITUACIONES, avisosDeSaldo, textoLiberacion } from './ingresos.ts'
import { formatearEuros } from './dinero.ts'

const sql = readFileSync(new URL('../../sql/105_ingresos_retencion.sql', import.meta.url), 'utf8')

test('situaciones y saldos coinciden con lo que devuelve la base de datos', () => {
  for (const s of Object.keys(SITUACIONES)) assert.ok(sql.includes(`'${s}'`), s)
  for (const { clave } of SALDOS) assert.ok(sql.includes(`'${clave}'`), clave)
})

test('la liberación de sql/105 es la de sql/072 con solo la retención añadida', () => {
  const funcion = (archivo: string) => {
    const s = readFileSync(new URL(`../../sql/${archivo}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    const i = s.indexOf('create or replace function public.liberar_pendientes()')
    return s.slice(i, s.indexOf('$$;', i))
  }
  const sinRetencion = funcion('105_ingresos_retencion.sql').replace(
    /\n {7}-- sql\/105:[^\n]*\n {7}and not public\.cobro_retenido\(c\.id, c\.reserva_id\)/,
    ''
  )
  assert.equal(sinRetencion, funcion('072_pagos_funciones.sql'))
})

test('avisos: solo cuando hay algo que explicar', () => {
  assert.deepEqual(avisosDeSaldo({ retenido_centimos: 0, en_devolucion_centimos: 0, disponible_centimos: 100 }, formatearEuros), [])
  const a = avisosDeSaldo({ retenido_centimos: 540, en_devolucion_centimos: 600, disponible_centimos: -10 }, formatearEuros)
  assert.equal(a.length, 3)
  assert.match(a[0], /5,40 € retenidos/)
  assert.match(a[1], /6,00 €/)
})

test('fecha de liberación en hora de Madrid', () => {
  const ahora = new Date('2026-11-27T10:00:00Z')
  assert.equal(textoLiberacion('pendiente', '2026-12-04T11:00:00+00:00', ahora), 'Disponible a partir del 04/12 a las 12:00.')
  assert.match(textoLiberacion('pendiente', '2026-11-27T09:00:00Z', ahora)!, /próximos minutos/)
  for (const s of ['disponible', 'retenido', 'devuelto']) assert.equal(textoLiberacion(s, '2026-12-04T11:00:00Z', ahora), null)
  assert.equal(textoLiberacion('pendiente', null, ahora), null)
  assert.equal(textoLiberacion('pendiente', 'basura', ahora), null)
})
