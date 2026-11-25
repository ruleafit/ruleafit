import test from 'node:test'
import assert from 'node:assert/strict'
import { prepararUbicacionParaPublicar } from './ubicacionPublicar.js'
import { crearUbicacion } from '../../lib/ubicacionSesion.js'

const tick = () => new Promise((r) => setTimeout(r, 5))
function montar() {
  const llamadas = []
  const u = crearUbicacion({ resolver: (lat, lng, { signal }) => new Promise((resolve) => llamadas.push({ resolve, signal })), retardoMapa: 0 })
  return { u, llamadas }
}

test('sin punto: no se publica y se explica', async () => {
  const { u } = montar()
  const r = await prepararUbicacionParaPublicar(u)
  assert.equal(r.ok, false)
  assert.match(r.mensaje, /seleccionar la ubicación/)
})

test('publicar justo tras elegir el resultado (sin tocar el mapa): espera al municipio y usa EXACTAMENTE esas coordenadas', async () => {
  const { u, llamadas } = montar()
  u.elegirBusqueda({ lat: 37.46, lng: -5.34, nombre: 'Polideportivo, Fuentes de Andalucía' })
  const mensajes = []
  const promesa = prepararUbicacionParaPublicar(u, (m) => mensajes.push(m))
  await tick(); llamadas[0].resolve({ nombre: 'Fuentes de Andalucía', provincia: 'Sevilla' })
  const r = await promesa
  assert.deepEqual(r.ubicacion, { lat: 37.46, lng: -5.34, ciudad: 'Fuentes de Andalucía', provincia: 'Sevilla' })
  assert.match(mensajes[0], /Identificando/)
})

test('cambia el pin mientras se espera: se publican las coordenadas y datos del ÚLTIMO punto', async () => {
  const { u, llamadas } = montar()
  u.elegirBusqueda({ lat: 1, lng: 1, nombre: 'A' }); await tick()
  const promesa = prepararUbicacionParaPublicar(u)
  u.elegirMapa(2, 2); await tick()
  llamadas[0].resolve({ nombre: 'Sevilla', provincia: 'Sevilla' }) // antigua: se descarta
  llamadas[1].resolve({ nombre: 'Marchena', provincia: 'Sevilla' })
  const r = await promesa
  assert.deepEqual(r.ubicacion, { lat: 2, lng: 2, ciudad: 'Marchena', provincia: 'Sevilla' })
})

test('fallo del servicio: no se pierde el punto; se pide corregir o reintentar; con corrección manual se publica', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(5, 6); await tick(); llamadas[0].resolve(null); await tick()
  const r = await prepararUbicacionParaPublicar(u)
  assert.equal(r.ok, false); assert.match(r.mensaje, /Reintentar|a mano/)
  assert.deepEqual([u.estado().lat, u.estado().lng], [5, 6])
  u.corregirManual({ ciudad: 'Écija', provincia: 'Sevilla' })
  const r2 = await prepararUbicacionParaPublicar(u)
  assert.deepEqual(r2.ubicacion, { lat: 5, lng: 6, ciudad: 'Écija', provincia: 'Sevilla' })
})

test('ubicación habitual (N09): se publica con sus datos sin consultar al servicio', async () => {
  const { u, llamadas } = montar()
  u.elegirGuardada({ id: 'g', nombre: 'Gimnasio', ciudad: 'Dos Hermanas', provincia: 'Sevilla', lat: 37.28, lng: -5.92 })
  const r = await prepararUbicacionParaPublicar(u)
  assert.deepEqual(r.ubicacion, { lat: 37.28, lng: -5.92, ciudad: 'Dos Hermanas', provincia: 'Sevilla' })
  assert.equal(llamadas.length, 0)
})

test('provincia vacía es válida (se guarda como null en el insert)', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(1, 2); await tick(); llamadas[0].resolve({ nombre: 'Madrid', provincia: '' }); await tick()
  const r = await prepararUbicacionParaPublicar(u)
  assert.equal(r.ok, true); assert.equal(r.ubicacion.provincia, '')
})
