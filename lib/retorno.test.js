import test from 'node:test'
import assert from 'node:assert/strict'

// localStorage simulado
const datos = new Map()
globalThis.window = { localStorage: { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) }, location: { search: '' } }
const r = await import('./retorno.js')

const ID = '3f2b9c1e-8a44-4d5e-9b61-0c7d2e5a1f90'

test('rutaSegura: solo /clases/<id>; rechaza externas, esquemas, // y rutas con parámetros', () => {
  assert.equal(r.rutaSegura(`/clases/${ID}`), `/clases/${ID}`)
  for (const mala of [
    'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/login', '/registro', '/', '',
    `/clases/${ID}?x=1`, `/clases/${ID}#a`, `/clases/${ID}/`, '/clases/../cuenta', '/clases/a', `/clases/${ID}%0d%0a`,
    `//clases/${ID}`, `https://ruleafit.com/clases/${ID}`, null, undefined, 42, {}, 'x'.repeat(500),
  ]) assert.equal(r.rutaSegura(mala), null, String(mala))
})

test('guardar y leer: devuelve ruta y título; descarta rutas no válidas', () => {
  datos.clear()
  assert.equal(r.guardarRetorno({ ruta: 'https://evil.com', titulo: 'x' }), false)
  assert.equal(r.leerRetorno(), null)
  assert.equal(r.guardarRetorno({ ruta: `/clases/${ID}`, titulo: 'Yoga\n<b>' }), true)
  assert.deepEqual(r.leerRetorno(), { ruta: `/clases/${ID}`, titulo: 'Yoga <b>', intencion: 'reservar' })
  assert.equal(r.destinoTrasLogin(), `/clases/${ID}`)
})

test('no guarda credenciales ni campos extra (ni invitaciones, reservado para C25)', () => {
  datos.clear()
  r.guardarRetorno({ ruta: `/clases/${ID}`, titulo: 't', password: 'secreto', token: 'abc', invitacion: 'amigo123' })
  const crudo = JSON.parse(datos.get('ruleafit_retorno'))
  assert.deepEqual(Object.keys(crudo).sort(), ['intencion', 'ruta', 'titulo', 'ts'])
})

test('caduca a las 6 h y se limpia solo', () => {
  datos.clear()
  r.guardarRetorno({ ruta: `/clases/${ID}` }, 1000)
  assert.ok(r.leerRetorno(1000 + r.CADUCIDAD_MS - 1))
  assert.equal(r.leerRetorno(1000 + r.CADUCIDAD_MS + 1), null)
  assert.equal(datos.has('ruleafit_retorno'), false)
})

test('almacén manipulado: JSON roto o ruta maliciosa → se ignora y destino = portada', () => {
  datos.set('ruleafit_retorno', '{no es json')
  assert.equal(r.leerRetorno(), null)
  datos.set('ruleafit_retorno', JSON.stringify({ ruta: 'https://evil.com', titulo: '', ts: Date.now() }))
  assert.equal(r.leerRetorno(), null)
  assert.equal(r.destinoTrasLogin(), '/')
})

test('ingerirVolverDeUrl: acepta ?volver válido, ignora inválido, conserva el título de la misma sesión', () => {
  datos.clear()
  assert.equal(r.ingerirVolverDeUrl('?volver=https://evil.com'), null)
  assert.equal(r.leerRetorno(), null)
  r.guardarRetorno({ ruta: `/clases/${ID}`, titulo: 'Spinning' })
  assert.deepEqual(r.ingerirVolverDeUrl(`?volver=/clases/${ID}`), { ruta: `/clases/${ID}`, titulo: 'Spinning', intencion: 'reservar' })
  assert.equal(r.ingerirVolverDeUrl('?volver=//evil.com'), null)
  assert.equal(r.leerRetorno().ruta, `/clases/${ID}`) // lo anterior no se pisa con basura
})

test('borrarRetorno', () => {
  r.guardarRetorno({ ruta: `/clases/${ID}` })
  r.borrarRetorno()
  assert.equal(r.leerRetorno(), null)
})

test('C15: intención reservar/avisar — se guarda, se valida y no se confunden', () => {
  datos.clear()
  const ruta = `/clases/${ID}`
  r.guardarRetorno({ ruta, titulo: 'Pilates', intencion: 'avisar' })
  assert.equal(r.leerRetorno().intencion, 'avisar')
  r.guardarRetorno({ ruta, titulo: 'Pilates' })
  assert.equal(r.leerRetorno().intencion, 'reservar') // por defecto
  r.guardarRetorno({ ruta, intencion: 'hackear' })
  assert.equal(r.leerRetorno().intencion, 'reservar') // valor desconocido → reservar
  datos.set('ruleafit_retorno', JSON.stringify({ ruta, titulo: '', intencion: '<script>', ts: Date.now() }))
  assert.equal(r.leerRetorno().intencion, 'reservar') // almacén manipulado
})

test('C15: ?volver con intencion explícita; sin ella se conserva la de la misma sesión', () => {
  datos.clear()
  const ruta = `/clases/${ID}`
  assert.equal(r.ingerirVolverDeUrl(`?volver=${ruta}&intencion=avisar`).intencion, 'avisar')
  assert.equal(r.ingerirVolverDeUrl(`?volver=${ruta}`).intencion, 'avisar') // misma sesión: no se pisa
  const OTRO = '9a8b7c6d-1111-4222-8333-444455556666'
  assert.equal(r.ingerirVolverDeUrl(`?volver=/clases/${OTRO}`).intencion, 'reservar') // otra sesión sin intención explícita
  assert.equal(r.ingerirVolverDeUrl(`?volver=${ruta}&intencion=otra`).intencion, 'reservar')
  assert.equal(r.ingerirVolverDeUrl('?volver=https://evil.com&intencion=avisar'), null)
})

test('C25: perfil público /entrenador/<usuario> como ruta de retorno, con intención seguir/favorito', () => {
  datos.clear()
  assert.equal(r.rutaSegura('/entrenador/ana_92'), '/entrenador/ana_92')
  for (const mala of ['/entrenador/', '/entrenador/a', '/entrenador/ana/opiniones', '/entrenador/ana?x=1', '/entrenador/a b', '/entrenador/../cuenta', '/entrenador/' + 'x'.repeat(21), '//entrenador/ana', 'https://x.com/entrenador/ana', '/entrenador/ana%0d']) {
    assert.equal(r.rutaSegura(mala), null, mala)
  }
  r.guardarRetorno({ ruta: '/entrenador/ana_92', titulo: '@ana_92', intencion: 'favorito' })
  assert.deepEqual(r.leerRetorno(), { ruta: '/entrenador/ana_92', titulo: '@ana_92', intencion: 'favorito' })
  r.guardarRetorno({ ruta: '/entrenador/ana_92', intencion: 'reservar' }) // intención de otra ruta → se corrige
  assert.equal(r.leerRetorno().intencion, 'seguir')
  r.guardarRetorno({ ruta: `/clases/${ID}`, intencion: 'seguir' })
  assert.equal(r.leerRetorno().intencion, 'reservar')
  assert.equal(r.ingerirVolverDeUrl('?volver=/entrenador/ana_92&intencion=favorito').intencion, 'favorito')
  assert.equal(r.ingerirVolverDeUrl('?volver=/entrenador/ana_92').intencion, 'favorito') // misma ruta: no se pisa
})
