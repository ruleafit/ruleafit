// Centro de incidencias económicas (sql/098). Valores y validaciones compartidos por la pantalla del alumno y el
// panel de administración. Deben coincidir con abrir_incidencia() y actualizar_incidencia().

export const TIPOS_INCIDENCIA = {
  cobro: 'Un cobro que no reconozco o es incorrecto',
  cancelacion: 'Una cancelación',
  reembolso: 'Un reembolso que no ha llegado',
} as const

export const ESTADOS_INCIDENCIA = {
  abierta: 'Recibida',
  en_revision: 'En revisión',
  resuelta: 'Resuelta',
  rechazada: 'No procede',
} as const

export type TipoIncidencia = keyof typeof TIPOS_INCIDENCIA
export type EstadoIncidencia = keyof typeof ESTADOS_INCIDENCIA

export const MIN_DESCRIPCION = 10
export const MAX_DESCRIPCION = 1000

export function esTipoIncidencia(valor: unknown): valor is TipoIncidencia {
  return typeof valor === 'string' && Object.hasOwn(TIPOS_INCIDENCIA, valor)
}

export function esEstadoIncidencia(valor: unknown): valor is EstadoIncidencia {
  return typeof valor === 'string' && Object.hasOwn(ESTADOS_INCIDENCIA, valor)
}

/** Devuelve el mensaje de error, o null si el formulario se puede enviar. */
export function errorDeIncidencia(reservaId: string, tipo: string, descripcion: string): string | null {
  if (!reservaId) return 'Elige la reserva.'
  if (!esTipoIncidencia(tipo)) return 'Elige el motivo.'
  const largo = descripcion.trim().length
  if (largo < MIN_DESCRIPCION || largo > MAX_DESCRIPCION) {
    return `Explica lo ocurrido con entre ${MIN_DESCRIPCION} y ${MAX_DESCRIPCION} caracteres.`
  }
  return null
}

/** ¿Tiene sentido «Devolver y cerrar»? Solo si el pago está cobrado y aún no devuelto. */
export function puedeDevolver(estadoCobro: string | null | undefined): boolean {
  return estadoCobro === 'pagado' || estadoCobro === 'requiere_reembolso'
}

export function estaCerrada(estado: string): boolean {
  return estado === 'resuelta' || estado === 'rechazada'
}
