import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretarRespuestaInversa, direccionFisicaDe } from './geocodificarInversa.js'

test('Fuentes de Andalucía: el municipio, no la provincia', () => {
  const r = interpretarRespuestaInversa({ address: { town: 'Fuentes de Andalucía', county: 'Sevilla', state: 'Andalucía', country_code: 'es' } })
  assert.deepEqual(r, { nombre: 'Fuentes de Andalucía', provincia: 'Sevilla' })
})

test('barrio o distrito: se usa el municipio al que pertenecen', () => {
  const r = interpretarRespuestaInversa({ address: { suburb: 'Nervión', city_district: 'Nervión', city: 'Sevilla', province: 'Sevilla', state: 'Andalucía', country_code: 'es' } })
  assert.equal(r.nombre, 'Sevilla')
})

test('pedanía: se usa el municipio administrativo si consta', () => {
  const r = interpretarRespuestaInversa({ address: { hamlet: 'La Isla', municipality: 'Dos Hermanas', county: 'Sevilla', country_code: 'es' } })
  assert.equal(r.nombre, 'Dos Hermanas')
})

test('sin municipio (solo pedanía o provincia): null, nunca la provincia', () => {
  assert.equal(interpretarRespuestaInversa({ address: { hamlet: 'La Isla', county: 'Sevilla', state: 'Andalucía', country_code: 'es' } }), null)
  assert.equal(interpretarRespuestaInversa({ address: { state: 'Andalucía', country_code: 'es' } }), null)
})

test('provincia: province, luego county y por último la comunidad (uniprovinciales)', () => {
  assert.equal(interpretarRespuestaInversa({ address: { city: 'Madrid', state: 'Comunidad de Madrid', country_code: 'es' } }).provincia, 'Comunidad de Madrid')
  assert.equal(interpretarRespuestaInversa({ address: { city: 'Granada', province: 'Granada', county: 'Otra', country_code: 'es' } }).provincia, 'Granada')
})

test('fuera de España, sin dirección o respuesta vacía: null', () => {
  assert.equal(interpretarRespuestaInversa({ address: { city: 'Lisboa', country_code: 'pt' } }), null)
  assert.equal(interpretarRespuestaInversa({}), null)
  assert.equal(interpretarRespuestaInversa(null), null)
})

test('dirección física: calle y número si constan', () => {
  assert.equal(direccionFisicaDe({ address: { road: 'Calle Feria', house_number: '25' } }), 'Calle Feria, 25')
  assert.equal(direccionFisicaDe({ address: { road: 'Avenida de la Constitución' } }), 'Avenida de la Constitución')
  assert.equal(direccionFisicaDe({ address: { city: 'Sevilla' } }), '')
})
