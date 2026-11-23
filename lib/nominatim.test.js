import test from 'node:test'
import assert from 'node:assert/strict'
import { crearColaNominatim } from './nominatim.js'

function cola(intervalo = 60) {
  const inicios = []
  const peticion = crearColaNominatim({ intervalo, lanzar: async (url) => { inicios.push({ url, t: Date.now() }); return { ok: true, url } } })
  return { peticion, inicios }
}

test('varias peticiones a la vez se espacian al menos el intervalo', async () => {
  const { peticion, inicios } = cola(60)
  await Promise.all([peticion('a'), peticion('b'), peticion('c'), peticion('d')])
  assert.equal(inicios.length, 4)
  for (let i = 1; i < inicios.length; i++) assert.ok(inicios[i].t - inicios[i - 1].t >= 55, `hueco de ${inicios[i].t - inicios[i - 1].t} ms`)
  assert.deepEqual(inicios.map((x) => x.url), ['a', 'b', 'c', 'd']) // en orden
})

test('la primera petición sale enseguida y una pasada la espera no se retrasa', async () => {
  const { peticion, inicios } = cola(60)
  const t0 = Date.now()
  await peticion('a')
  assert.ok(inicios[0].t - t0 < 30)
  await new Promise((r) => setTimeout(r, 80))
  const t1 = Date.now()
  await peticion('b')
  assert.ok(inicios[1].t - t1 < 30)
})

test('una petición cancelada mientras espera se descarta y no gasta turno', async () => {
  const { peticion, inicios } = cola(80)
  await peticion('a')
  const c = new AbortController()
  const cancelada = peticion('b', { signal: c.signal })
  const siguiente = peticion('c')
  setTimeout(() => c.abort(), 10)
  await assert.rejects(cancelada, { name: 'AbortError' })
  await siguiente
  assert.deepEqual(inicios.map((x) => x.url), ['a', 'c']) // «b» nunca salió
  assert.ok(inicios[1].t - inicios[0].t >= 70)
})

test('una petición ya cancelada antes de empezar ni se lanza', async () => {
  const { peticion, inicios } = cola(20)
  const c = new AbortController()
  c.abort()
  await assert.rejects(peticion('x', { signal: c.signal }), { name: 'AbortError' })
  assert.equal(inicios.length, 0)
})

test('un fallo de una petición no bloquea la cola', async () => {
  let n = 0
  const peticion = crearColaNominatim({ intervalo: 10, lanzar: async () => { n++; if (n === 1) throw new Error('red'); return 'ok' } })
  await assert.rejects(peticion('a'))
  assert.equal(await peticion('b'), 'ok')
})
