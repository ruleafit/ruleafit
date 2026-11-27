// Mensaje de un fallo del servidor al guardar datos fiscales: dice en qué paso y por qué.
// Fuera de producción se incluye el mensaje de la base de datos; en producción solo el código (no se enseñan
// detalles internos a cualquiera).

export type ErrorBase = { code?: string; message?: string } | null | undefined

const PISTAS: Record<string, string> = {
  '42501': 'A la base de datos le faltan permisos.',
  '42883': 'Falta una función SQL en la base de datos.',
  PGRST202: 'Falta una función SQL en la base de datos.',
  '42P01': 'Falta una tabla en la base de datos.',
  PGRST205: 'Falta una tabla en la base de datos.',
  '42703': 'Falta una columna en la base de datos.',
}

export function mensajeErrorGuardado(paso: string, error: ErrorBase, entorno: string | undefined): string {
  const codigo = error?.code || 'sin código'
  const pista = (error?.code && PISTAS[error.code]) || ''
  const detalle = entorno !== 'production' && error?.message ? `: ${error.message}` : ''
  return [`No se han podido guardar los datos (fallo al ${paso}).`, pista, `Error ${codigo}${detalle}`]
    .filter(Boolean)
    .join(' ')
}
