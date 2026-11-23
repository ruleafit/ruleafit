import test from 'node:test'
import assert from 'node:assert/strict'
import { coincideConPrecio, coincideConDuracion, tienePlazasLibres, textoPrecioRango } from './filtros.js'

test('precio: sin tocar la barra no hay restricción (también salen las de más de 50 €)', () => {
  for (const precio of [0, 12.5, 50, 80, 300]) assert.equal(coincideConPrecio({ precio }, null), true)
})

test('precio: límites incluidos, gratuitas con precio 0 y valores vacíos', () => {
  const r = { min: 10, max: 25 }
  assert.equal(coincideConPrecio({ precio: 9.99 }, r), false)
  assert.equal(coincideConPrecio({ precio: 10 }, r), true)
  assert.equal(coincideConPrecio({ precio: 25 }, r), true)
  assert.equal(coincideConPrecio({ precio: 25.01 }, r), false)
  assert.equal(coincideConPrecio({ precio: 0 }, { min: 0, max: 15 }), true) // gratuita en 0–15
  assert.equal(coincideConPrecio({ precio: 0 }, r), false) // gratuita fuera de 10–25
  assert.equal(coincideConPrecio({ precio: null }, { min: 0, max: 0 }), true) // vacío = gratuita
  assert.equal(coincideConPrecio({ precio: '12.50' }, { min: 12, max: 13 }), true) // numeric llega como texto
})

test('precio: un rango explícito 0–50 SÍ excluye las de más de 50 €', () => {
  assert.equal(coincideConPrecio({ precio: 60 }, { min: 0, max: 50 }), false)
  assert.equal(coincideConPrecio({ precio: 50 }, { min: 0, max: 50 }), true)
})

test('duración: límites de cada tramo', () => {
  const d = (duracion, tramo) => coincideConDuracion({ duracion }, tramo)
  assert.equal(d(30, 'hasta30'), true)
  assert.equal(d(31, 'hasta30'), false)
  assert.equal(d(31, '31a60'), true)
  assert.equal(d(60, '31a60'), true)
  assert.equal(d(61, '31a60'), false)
  assert.equal(d(61, '61a90'), true)
  assert.equal(d(90, '61a90'), true)
  assert.equal(d(91, '61a90'), false)
  assert.equal(d(91, 'mas90'), true)
  assert.equal(d(90, 'mas90'), false)
  assert.equal(d(15, 'hasta30'), true)
})

test('duración: sin duración aparece solo si no se aplica el filtro', () => {
  for (const duracion of [null, undefined, 0, '']) {
    assert.equal(coincideConDuracion({ duracion }, 'Todas'), true)
    assert.equal(coincideConDuracion({ duracion }, undefined), true)
    for (const tramo of ['hasta30', '31a60', '61a90', 'mas90']) assert.equal(coincideConDuracion({ duracion }, tramo), false)
  }
})

test('plazas libres: completas fuera, con hueco dentro', () => {
  assert.equal(tienePlazasLibres({ plazas_max: 10, plazas_ocupadas: 9 }), true)
  assert.equal(tienePlazasLibres({ plazas_max: 10, plazas_ocupadas: 10 }), false)
  assert.equal(tienePlazasLibres({ plazas_max: 10, plazas_ocupadas: 12 }), false)
  assert.equal(tienePlazasLibres({ plazas_max: 10 }), true)
  assert.equal(tienePlazasLibres({ plazas_max: null, plazas_ocupadas: 3 }), true)
})

test('texto del rango', () => {
  assert.equal(textoPrecioRango(null), 'Cualquier precio')
  assert.equal(textoPrecioRango({ min: 5, max: 25 }), '5 € – 25 €')
  assert.equal(textoPrecioRango({ min: 0, max: 15 }), '0 € – 15 €')
})
