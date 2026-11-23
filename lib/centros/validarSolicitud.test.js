import test from 'node:test'
import assert from 'node:assert/strict'
import { validarSolicitud, limpiarTexto, LIMITES } from './validarSolicitud.js'

const buena = { centro: 'Gimnasio Centro', ciudad: 'Sevilla', contacto: 'Ana Pérez', email: 'Ana@Centro.es', tipo: 'demostracion', privacidad: true }

test('solicitud mínima válida (teléfono y mensaje opcionales) y email en minúsculas', () => {
  const { errores, valores } = validarSolicitud(buena)
  assert.deepEqual(errores, {})
  assert.equal(valores.email, 'ana@centro.es')
  assert.equal(valores.telefono, '')
  assert.equal(valores.mensaje, '')
})

test('campos obligatorios', () => {
  const { errores } = validarSolicitud({})
  assert.deepEqual(Object.keys(errores).sort(), ['centro', 'ciudad', 'contacto', 'email', 'privacidad', 'tipo'])
})

test('opcionales con datos válidos y no válidos', () => {
  assert.deepEqual(validarSolicitud({ ...buena, telefono: '+34 600 123 456', mensaje: 'Hola\nQuiero info' }).errores, {})
  assert.ok(validarSolicitud({ ...buena, telefono: 'abc' }).errores.telefono)
  assert.ok(validarSolicitud({ ...buena, telefono: '12' }).errores.telefono)
})

test('consentimiento de privacidad obligatorio y solo con true', () => {
  assert.ok(validarSolicitud({ ...buena, privacidad: false }).errores.privacidad)
  assert.ok(validarSolicitud({ ...buena, privacidad: 'true' }).errores.privacidad)
})

test('tipo de solicitud: solo los tres permitidos', () => {
  for (const t of ['demostracion', 'informacion', 'ayuda']) assert.equal(validarSolicitud({ ...buena, tipo: t }).errores.tipo, undefined)
  assert.ok(validarSolicitud({ ...buena, tipo: 'otra' }).errores.tipo)
})

test('emails inválidos o con inyección de cabeceras', () => {
  for (const email of ['sin-arroba', 'a@b', 'a b@c.es', 'x@y.es\nBcc: otro@z.es', 'a@b.es,c@d.es', '<x>@y.es']) {
    assert.ok(validarSolicitud({ ...buena, email }).errores.email, email)
  }
})

test('longitudes máximas', () => {
  assert.ok(validarSolicitud({ ...buena, centro: 'x'.repeat(LIMITES.centro + 1) }).errores.centro)
  assert.ok(validarSolicitud({ ...buena, mensaje: 'x'.repeat(LIMITES.mensaje + 1) }).errores.mensaje)
  assert.equal(validarSolicitud({ ...buena, mensaje: 'x'.repeat(LIMITES.mensaje) }).errores.mensaje, undefined)
})

test('limpieza: caracteres de control fuera, saltos solo en el mensaje, HTML como texto', () => {
  assert.equal(limpiarTexto('Centro\r\nBcc: x\u0000'), 'Centro Bcc: x')
  assert.equal(limpiarTexto('a\n\n\n\nb', { saltos: true }), 'a\n\nb')
  assert.equal(validarSolicitud({ ...buena, centro: '<script>alert(1)</script> Gym' }).valores.centro, '<script>alert(1)</script> Gym') // se guarda como texto; nunca se interpreta
})
