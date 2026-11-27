// Solo servidor. Huella de un número de documento (HMAC): permite detectar que
// el mismo documento intenta verificar dos cuentas sin guardar el número.
import { createHmac } from 'node:crypto'
import { normalizar } from './documentos.js'

export function huellaDocumento(numero, secreto = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!secreto) throw new Error('Falta la clave del servidor.')
  return createHmac('sha256', secreto).update(`documento:${normalizar(numero)}`).digest('hex')
}
