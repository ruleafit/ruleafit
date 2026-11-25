import test from 'node:test'
import assert from 'node:assert/strict'
import { crearUbicacion, nombreCortoLugar, ZOOM_BUSQUEDA } from './ubicacionSesion.js'

// Resolvedor controlable: cada llamada devuelve una promesa que el test resuelve cuando quiere.
function montar() {
  const llamadas = []
  const resolver = (lat, lng, { signal }) => new Promise((resolve) => llamadas.push({ lat, lng, signal, resolve }))
  const u = crearUbicacion({ resolver, retardoMapa: 0 })
  return { u, llamadas }
}
const tick = () => new Promise((r) => setTimeout(r, 5))
const FUENTES = { nombre: 'Fuentes de Andalucía', provincia: 'Sevilla' }
const SEVILLA = { nombre: 'Sevilla', provincia: 'Sevilla' }
const MARCHENA = { nombre: 'Marchena', provincia: 'Sevilla' }

test('elegir un resultado del buscador fija YA la ubicación definitiva (sin tocar el mapa) y resuelve municipio y provincia', async () => {
  const { u, llamadas } = montar()
  u.elegirBusqueda({ lat: 37.46, lng: -5.34, nombre: 'Polideportivo Municipal, Calle Real, Fuentes de Andalucía, Sevilla' })
  const e = u.estado()
  assert.equal(e.lat, 37.46); assert.equal(e.lng, -5.34)
  assert.equal(e.origen, 'busqueda'); assert.equal(e.aviso, 'busqueda')
  assert.equal(e.lugar, 'Polideportivo Municipal')
  assert.deepEqual([e.foco.lat, e.foco.lng, e.foco.zoom], [37.46, -5.34, ZOOM_BUSQUEDA])
  assert.equal(u.validar().motivo, 'resolviendo')
  await tick(); assert.equal(llamadas.length, 1)
  llamadas[0].resolve(FUENTES); await tick()
  const f = u.estado()
  assert.deepEqual([f.ciudad, f.provincia, f.estado], ['Fuentes de Andalucía', 'Sevilla', 'listo'])
  assert.deepEqual(u.validar(), { ok: true, motivo: '' })
})

test('sin punto no se puede publicar', () => {
  const { u } = montar()
  assert.deepEqual(u.validar(), { ok: false, motivo: 'sin_punto' })
})

test('respuesta antigua: una resolución lenta del punto anterior NO pisa al punto más reciente', async () => {
  const { u, llamadas } = montar()
  u.elegirBusqueda({ lat: 37.38, lng: -5.99, nombre: 'Calle Feria, Sevilla' })
  await tick()
  u.elegirMapa(37.33, -5.41) // cambia al instante a otro municipio
  await tick()
  assert.equal(llamadas.length, 2)
  assert.equal(llamadas[0].signal.aborted, true) // la anterior se cancela
  llamadas[1].resolve(MARCHENA); await tick()
  llamadas[0].resolve(SEVILLA); await tick() // llega TARDE
  const e = u.estado()
  assert.deepEqual([e.ciudad, e.provincia, e.lat, e.lng], ['Marchena', 'Sevilla', 37.33, -5.41])
})

test('aunque la respuesta antigua llegue primero, se descarta', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(1, 1); await tick()
  u.elegirMapa(2, 2); await tick()
  llamadas[0].resolve(SEVILLA); await tick()
  assert.equal(u.estado().ciudad, '') // aún sin datos del punto actual
  assert.equal(u.estado().estado, 'resolviendo')
  llamadas[1].resolve(MARCHENA); await tick()
  assert.equal(u.estado().ciudad, 'Marchena')
})

test('al mover el pin se borran el municipio y la provincia del punto anterior (nunca se guardan datos de otro punto)', async () => {
  const { u, llamadas } = montar()
  u.elegirBusqueda({ lat: 1, lng: 1, nombre: 'A' }); await tick(); llamadas[0].resolve(SEVILLA); await tick()
  assert.equal(u.estado().ciudad, 'Sevilla')
  u.elegirMapa(2, 2)
  const e = u.estado()
  assert.deepEqual([e.ciudad, e.provincia, e.aviso, e.origen], ['', '', 'ajustada', 'mapa'])
  assert.equal(u.validar().motivo, 'resolviendo')
})

test('varios toques seguidos: solo se aplica la resolución del último', async () => {
  const { u, llamadas } = montar()
  for (const [a, b] of [[1, 1], [2, 2], [3, 3]]) { u.elegirMapa(a, b); await tick() }
  assert.equal(llamadas.filter((l) => l.signal.aborted).length, 2)
  llamadas[2].resolve(MARCHENA); await tick()
  llamadas[0].resolve(SEVILLA); llamadas[1].resolve(FUENTES); await tick()
  assert.deepEqual([u.estado().ciudad, u.estado().lat], ['Marchena', 3])
})

test('fallo del servicio: se conservan las coordenadas, se puede reintentar o corregir a mano', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(37.4, -5.3); await tick(); llamadas[0].resolve(null); await tick()
  let e = u.estado()
  assert.deepEqual([e.estado, e.lat, e.lng, e.ciudad], ['fallo', 37.4, -5.3, ''])
  assert.equal(u.validar().motivo, 'sin_municipio')
  u.reintentar(); await tick(); llamadas[1].resolve(FUENTES); await tick()
  assert.equal(u.estado().ciudad, 'Fuentes de Andalucía')
  // corrección manual
  u.corregirManual({ ciudad: ' Écija ', provincia: 'Sevilla' })
  e = u.estado()
  assert.deepEqual([e.ciudad, e.provincia, e.estado], ['Écija', 'Sevilla', 'manual'])
  assert.equal(u.validar().ok, true)
  u.corregirManual({ ciudad: '  ', provincia: '' })
  assert.equal(u.estado().estado, 'fallo')
})

test('un error del resolvedor se trata como fallo sin perder el punto', async () => {
  const u = crearUbicacion({ resolver: async () => { throw new Error('red') }, retardoMapa: 0 })
  u.elegirMapa(5, 6); await tick(); await tick()
  assert.deepEqual([u.estado().estado, u.estado().lat], ['fallo', 5])
})

test('la corrección manual cancela una resolución en curso (la respuesta tardía no la pisa)', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(1, 1); await tick()
  u.corregirManual({ ciudad: 'Osuna', provincia: 'Sevilla' })
  llamadas[0].resolve(SEVILLA); await tick()
  assert.equal(u.estado().ciudad, 'Osuna')
})

test('ubicación habitual completa (N09): sus datos se usan tal cual, sin consultar al servicio', async () => {
  const { u, llamadas } = montar()
  const guardada = Object.freeze({ id: 'g1', nombre: 'Mi gimnasio', ciudad: 'Dos Hermanas', provincia: 'Sevilla', lat: 37.28, lng: -5.92 })
  u.elegirGuardada(guardada); await tick()
  const e = u.estado()
  assert.deepEqual([e.ciudad, e.provincia, e.estado, e.aviso, e.lugar], ['Dos Hermanas', 'Sevilla', 'listo', 'guardada', 'Mi gimnasio'])
  assert.equal(llamadas.length, 0)
  assert.equal(u.validar().ok, true)
})

test('ubicación habitual sin provincia: se completa la provincia sin tocar el municipio', async () => {
  const { u, llamadas } = montar()
  u.elegirGuardada({ nombre: 'X', ciudad: 'Dos Hermanas', provincia: '', lat: 1, lng: 2 }); await tick()
  assert.equal(llamadas.length, 1)
  llamadas[0].resolve({ nombre: 'OTRO MUNICIPIO', provincia: 'Sevilla' }); await tick()
  assert.deepEqual([u.estado().ciudad, u.estado().provincia, u.estado().estado], ['Dos Hermanas', 'Sevilla', 'listo'])
})

test('ubicación habitual antigua sin municipio: se resuelve desde sus coordenadas', async () => {
  const { u, llamadas } = montar()
  u.elegirGuardada({ nombre: 'Vieja', ciudad: '', lat: 3, lng: 4 }); await tick()
  llamadas[0].resolve(FUENTES); await tick()
  assert.equal(u.estado().ciudad, 'Fuentes de Andalucía')
})

test('ajustar el pin de una sesión basada en una ubicación habitual: nueva ubicación, la guardada no se modifica', async () => {
  const { u, llamadas } = montar()
  const guardada = Object.freeze({ id: 'g1', nombre: 'Mi gimnasio', ciudad: 'Dos Hermanas', provincia: 'Sevilla', lat: 37.28, lng: -5.92 })
  u.elegirGuardada(guardada); await tick()
  u.elegirMapa(37.3, -5.9); await tick(); llamadas[0].resolve(SEVILLA); await tick()
  const e = u.estado()
  assert.deepEqual([e.lat, e.lng, e.ciudad, e.aviso, e.lugar], [37.3, -5.9, 'Sevilla', 'ajustada', ''])
  assert.deepEqual({ ...guardada }, { id: 'g1', nombre: 'Mi gimnasio', ciudad: 'Dos Hermanas', provincia: 'Sevilla', lat: 37.28, lng: -5.92 })
})

test('sesión copiada: conserva el municipio y obtiene la provincia del punto', async () => {
  const { u, llamadas } = montar()
  u.cargar({ lat: 37.46, lng: -5.34, ciudad: 'Fuentes de Andalucía', provincia: '' }); await tick()
  assert.equal(u.estado().estado, 'listo'); assert.equal(llamadas.length, 1)
  llamadas[0].resolve(FUENTES); await tick()
  assert.deepEqual([u.estado().ciudad, u.estado().provincia], ['Fuentes de Andalucía', 'Sevilla'])
  u.cargar({ lat: null, lng: null }); assert.equal(u.estado().estado, 'vacio')
})

test('esperarResolucion: devuelve el estado final al terminar, o el actual si se agota el tiempo', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(1, 1)
  const espera = u.esperarResolucion(1000)
  await tick(); llamadas[0].resolve(SEVILLA)
  assert.equal((await espera).ciudad, 'Sevilla')
  u.elegirMapa(2, 2)
  const agotada = await u.esperarResolucion(20)
  assert.equal(agotada.estado, 'resolviendo')
  assert.equal((await u.esperarResolucion(20)).estado, 'resolviendo')
})

test('limpiar vacía todo y descarta resoluciones pendientes', async () => {
  const { u, llamadas } = montar()
  u.elegirMapa(1, 1); await tick(); u.limpiar()
  llamadas[0].resolve(SEVILLA); await tick()
  assert.deepEqual([u.estado().estado, u.estado().lat, u.estado().ciudad], ['vacio', null, ''])
})

test('nombre corto del lugar', () => {
  assert.equal(nombreCortoLugar('Polideportivo Municipal, Calle Real, Fuentes de Andalucía'), 'Polideportivo Municipal')
  assert.equal(nombreCortoLugar(''), '')
  assert.equal(nombreCortoLugar(undefined), '')
})
