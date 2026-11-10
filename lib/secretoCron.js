import { timingSafeEqual } from 'node:crypto'

// Solo servidor. Comprueba la cabecera "Authorization: Bearer <CRON_SECRET>" de
// las rutas que solo debe llamar la base de datos (pg_net / pg_cron).
// - Si CRON_SECRET no está definido, NADIE pasa (antes la comparación con
//   "Bearer undefined" habría dejado entrar a cualquiera).
// - La comparación es de tiempo constante.
export function cronAutorizado(request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const recibido = Buffer.from(request.headers.get('authorization') || '')
  const esperado = Buffer.from(`Bearer ${secreto}`)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}
