import test from 'node:test'
import assert from 'node:assert/strict'

const datos = new Map()
globalThis.window = { localStorage: { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) } }
const inv = await import('./invitacion.js')
const retorno = await import('./retorno.js')

const BILLETE = '3f2b9c1e-8a44-4d5e-9b61-0c7d2e5a1f90'

test('código del enlace: 8 caracteres A-Z0-9; rechaza todo lo demás', () => {
  assert.equal(inv.codigoInvitacionValido('3F2B9C1E'), true)
  assert.equal(inv.codigoInvitacionValido('3f2b9c1e'), true)
  for (const malo of ['', 'ABC', '3F2B9C1E1', '3F2B-C1E', "ABC'; DROP", '../../x', null, undefined, 12345678, {}]) assert.equal(inv.codigoInvitacionValido(malo), false, String(malo))
})

test('billete: solo UUID', () => {
  assert.equal(inv.billeteValido(BILLETE), true)
  for (const malo of ['', '3F2B9C1E', 'x', `${BILLETE}x`, "'; drop table", null, undefined, 5]) assert.equal(inv.billeteValido(malo), false, String(malo))
})

test('guardar y leer: solo se guarda el billete (sin código ni datos); caduca a los 30 días', () => {
  datos.clear()
  assert.equal(inv.guardarInvitacion('x'), false)
  assert.equal(inv.leerInvitacion(), null)
  assert.equal(inv.guardarInvitacion(BILLETE.toUpperCase(), 1000), true)
  assert.equal(inv.leerInvitacion(1000 + 1000), BILLETE)
  assert.deepEqual(Object.keys(JSON.parse(datos.get('ruleafit_invitacion'))).sort(), ['billete', 'ts'])
  assert.equal(inv.leerInvitacion(1000 + inv.CADUCIDAD_INVITACION_MS + 1), null)
  assert.equal(datos.has('ruleafit_invitacion'), false)
})

test('almacén manipulado: se ignora', () => {
  datos.set('ruleafit_invitacion', '{no json')
  assert.equal(inv.leerInvitacion(), null)
  datos.set('ruleafit_invitacion', JSON.stringify({ billete: 'https://evil.com', ts: Date.now() }))
  assert.equal(inv.leerInvitacion(), null)
})

test('la invitación y la ruta de retorno (C03/C15/C25) coexisten sin pisarse', () => {
  datos.clear()
  const ID = '3f2b9c1e-8a44-4d5e-9b61-0c7d2e5a1f90'
  inv.guardarInvitacion(BILLETE)
  retorno.guardarRetorno({ ruta: `/clases/${ID}`, titulo: 'Pilates', intencion: 'avisar' })
  assert.equal(inv.leerInvitacion(), BILLETE)
  assert.equal(retorno.leerRetorno().intencion, 'avisar')
  retorno.guardarRetorno({ ruta: `/clases/${ID}`, titulo: 'Pilates', intencion: 'reservar' })
  assert.equal(inv.leerInvitacion(), BILLETE)
  retorno.guardarRetorno({ ruta: '/entrenador/ana_92', titulo: '@ana_92', intencion: 'seguir' })
  assert.equal(inv.leerInvitacion(), BILLETE)
  retorno.borrarRetorno()
  assert.equal(inv.leerInvitacion(), BILLETE)
  inv.borrarInvitacion()
  assert.equal(retorno.leerRetorno(), null)
})

test('abrir un perfil no guarda ninguna invitación', () => {
  datos.clear()
  retorno.guardarRetorno({ ruta: '/entrenador/ana_92', titulo: '@ana_92', intencion: 'favorito' })
  retorno.ingerirVolverDeUrl('?volver=/entrenador/ana_92&intencion=seguir')
  assert.equal(inv.leerInvitacion(), null)
})

test('reclamarInvitacionPendiente: llama al servidor solo con el billete, no envía cantidades, y limpia', async () => {
  datos.clear()
  inv.guardarInvitacion(BILLETE)
  const llamadas = []
  const supabase = { rpc: async (n, a) => { llamadas.push([n, a]); return { data: { estado: 'concedida' } } } }
  assert.equal(await inv.reclamarInvitacionPendiente(supabase), 'concedida')
  assert.deepEqual(llamadas, [['reclamar_invitacion', { p_ticket: BILLETE }]])
  assert.equal(inv.leerInvitacion(), null)
  assert.equal(await inv.reclamarInvitacionPendiente(supabase), null)
  assert.equal(llamadas.length, 1)
})

test('reclamarInvitacionPendiente: una respuesta de rechazo también limpia; un error de red conserva el billete', async () => {
  datos.clear()
  inv.guardarInvitacion(BILLETE)
  assert.equal(await inv.reclamarInvitacionPendiente({ rpc: async () => ({ data: { estado: 'no_nueva' } }) }), 'no_nueva')
  assert.equal(inv.leerInvitacion(), null)
  inv.guardarInvitacion(BILLETE)
  assert.equal(await inv.reclamarInvitacionPendiente({ rpc: async () => { throw new Error('red') } }), null)
  assert.equal(inv.leerInvitacion(), BILLETE)
  assert.equal(await inv.reclamarInvitacionPendiente({ rpc: async () => ({ data: null, error: { message: 'x' } }) }), null)
  assert.equal(inv.leerInvitacion(), BILLETE)
})
