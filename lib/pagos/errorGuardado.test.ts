import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeErrorGuardado } from './errorGuardado.ts'

const denegado = { code: '42501', message: 'permission denied for table perfiles_fiscales' }

test('en Preview y local se ve el error real, con el paso y una pista', () => {
  for (const entorno of ['preview', 'development', undefined]) {
    const m = mensajeErrorGuardado('leer tus datos actuales', denegado, entorno)
    assert.match(m, /fallo al leer tus datos actuales/)
    assert.match(m, /faltan permisos/)
    assert.match(m, /Error 42501: permission denied for table perfiles_fiscales/)
  }
})

test('en producción solo el código, sin detalles internos', () => {
  const m = mensajeErrorGuardado('guardar', denegado, 'production')
  assert.match(m, /Error 42501$/)
  assert.ok(!m.includes('perfiles_fiscales'))
})

test('sin código ni mensaje no falla', () => {
  assert.match(mensajeErrorGuardado('guardar', null, 'preview'), /Error sin código/)
  assert.match(mensajeErrorGuardado('guardar', { code: 'PGRST202' }, 'preview'), /Falta una función SQL/)
})
