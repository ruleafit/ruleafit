import test from 'node:test'
import assert from 'node:assert/strict'
import { procesarSolicitud, construirCorreo } from './procesarSolicitud.js'

const cuerpoBueno = { centro: 'Gimnasio Centro', ciudad: 'Sevilla', contacto: 'Ana', email: 'ana@centro.es', telefono: '', tipo: 'demostracion', mensaje: '', privacidad: true, web: '', ms: 9000 }

function entorno({ rpc, correo } = {}) {
  const e = { llamadasRpc: [], correos: [], actualizaciones: [], errores: [], intentos: 0 }
  e.admin = {
    rpc: async (nombre, args) => { e.llamadasRpc.push({ nombre, args }); return rpc ? rpc(args, e) : { data: { id: 'ID1', nuevo: true, aviso_pendiente: true }, error: null } },
    from: () => ({
      update: (cambios) => ({ eq: async (c, id) => { e.actualizaciones.push({ cambios, id }); return { error: null } } }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { aviso_intentos: e.intentos } }) }) }),
    }),
  }
  e.enviarCorreo = async (c) => { e.correos.push(c); return correo ? correo(c) : { error: null } }
  e.base = { origen: 'https://www.ruleafit.com', host: 'www.ruleafit.com', admin: e.admin, enviarCorreo: e.enviarCorreo, correoAdmin: 'admin@ruleafit.test', registrarError: (...a) => e.errores.push(a.join(' ')) }
  return e
}

test('solicitud correcta: se guarda primero y se envía el aviso con los datos', async () => {
  const e = entorno()
  const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(r.estado, 200)
  assert.equal(e.llamadasRpc.length, 1)
  assert.equal(e.correos.length, 1)
  assert.equal(e.correos[0].para, 'admin@ruleafit.test')
  assert.equal(e.correos[0].respuestaA, 'ana@centro.es')
  assert.match(e.correos[0].texto, /Centro: Gimnasio Centro/)
  assert.match(e.correos[0].texto, /Ciudad o municipio: Sevilla/)
  assert.match(e.correos[0].texto, /Persona de contacto: Ana/)
  assert.match(e.correos[0].texto, /Solicitar una demostración/)
  assert.match(e.correos[0].texto, /Teléfono: \(no indicado\)/)
  assert.deepEqual(e.actualizaciones.map((a) => Object.keys(a.cambios)), [['aviso_enviado_at']])
})

test('validación en el servidor: campos obligatorios y consentimiento; nada se guarda', async () => {
  const e = entorno()
  const r = await procesarSolicitud({ ...e.base, cuerpo: { ...cuerpoBueno, centro: '', privacidad: false } })
  assert.equal(r.estado, 400)
  assert.ok(r.json.errores.centro && r.json.errores.privacidad)
  assert.equal(e.llamadasRpc.length, 0)
  assert.equal(e.correos.length, 0)
})

test('si el correo falla, la solicitud sigue guardada, se responde éxito y se anota el intento', async () => {
  const e = entorno({ correo: async () => ({ error: new Error('Resend caído') }) })
  e.intentos = 1
  const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(r.estado, 200)
  assert.equal(e.llamadasRpc.length, 1)
  assert.deepEqual(e.actualizaciones, [{ cambios: { aviso_intentos: 2 }, id: 'ID1' }]) // sin marcar el aviso como enviado
  assert.ok(e.errores.some((x) => x.includes('Resend caído')))
})

test('si el correo lanza una excepción tampoco se pierde la solicitud', async () => {
  const e = entorno({ correo: async () => { throw new Error('red') } })
  const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(r.estado, 200)
  assert.equal(e.actualizaciones[0].cambios.aviso_intentos, 1)
})

test('reintento tras un fallo: misma solicitud (sin duplicar) y se vuelve a intentar solo el aviso', async () => {
  let fallar = true
  const e = entorno({ correo: async () => (fallar ? { error: new Error('x') } : { error: null }), rpc: async () => ({ data: { id: 'ID1', nuevo: false, aviso_pendiente: true }, error: null }) })
  await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  fallar = false
  await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(e.correos.length, 2)
  assert.ok(e.actualizaciones.some((a) => 'aviso_enviado_at' in a.cambios))
})

test('doble envío con el aviso ya enviado: no se vuelve a mandar el correo', async () => {
  const e = entorno({ rpc: async () => ({ data: { id: 'ID1', nuevo: false, aviso_pendiente: false }, error: null }) })
  const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(r.estado, 200)
  assert.equal(e.correos.length, 0)
})

test('sin correo administrativo configurado: se guarda y se avisa en el registro, sin fallar', async () => {
  const e = entorno()
  const r = await procesarSolicitud({ ...e.base, correoAdmin: '', cuerpo: cuerpoBueno })
  assert.equal(r.estado, 200)
  assert.equal(e.correos.length, 0)
  assert.ok(e.errores.some((x) => x.includes('correo administrativo')))
})

test('anti-spam: campo trampa relleno, formulario enviado demasiado rápido y origen ajeno', async () => {
  const e1 = entorno(); const r1 = await procesarSolicitud({ ...e1.base, cuerpo: { ...cuerpoBueno, web: 'http://spam' } })
  assert.equal(r1.estado, 200); assert.equal(e1.llamadasRpc.length, 0); assert.equal(e1.correos.length, 0)
  const e2 = entorno(); const r2 = await procesarSolicitud({ ...e2.base, cuerpo: { ...cuerpoBueno, ms: 300 } })
  assert.equal(r2.estado, 400); assert.equal(e2.llamadasRpc.length, 0)
  const e3 = entorno(); const r3 = await procesarSolicitud({ ...e3.base, origen: 'https://otra-web.com', cuerpo: cuerpoBueno })
  assert.equal(r3.estado, 403); assert.equal(e3.llamadasRpc.length, 0)
  const e4 = entorno(); const r4 = await procesarSolicitud({ ...e4.base, cuerpo: null })
  assert.equal(r4.estado, 400)
})

test('límites de la base de datos: 429 con mensaje claro y sin correo', async () => {
  for (const msg of ['limite_global', 'limite_correo']) {
    const e = entorno({ rpc: async () => ({ data: null, error: { message: msg } }) })
    const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
    assert.equal(r.estado, 429)
    assert.equal(e.correos.length, 0)
  }
})

test('error de base de datos: 500 sin correo ni datos internos en la respuesta', async () => {
  const e = entorno({ rpc: async () => ({ data: null, error: { message: 'connection refused secreto-interno' } }) })
  const r = await procesarSolicitud({ ...e.base, cuerpo: cuerpoBueno })
  assert.equal(r.estado, 500)
  assert.ok(!JSON.stringify(r.json).includes('secreto-interno'))
  assert.equal(e.correos.length, 0)
})

test('contenido del correo: asunto sin saltos de línea y texto plano', () => {
  const c = construirCorreo({ centro: 'Gym <b>X</b>', ciudad: 'S', contacto: 'C', email: 'a@b.es', telefono: '', tipo: 'ayuda', mensaje: 'hola' }, 'ID')
  assert.ok(!/[\r\n]/.test(c.asunto))
  assert.match(c.texto, /Ayuda para empezar/)
})
