import { formatearEuros } from './dinero.ts'

// Qué se le dice al alumno sobre su dinero cuando una reserva se cancela. La devolución se pone en marcha sola
// (el cobro pasa a 'requiere_reembolso'); no se afirma que el dinero ya haya llegado hasta que el banco confirma.

export const DEVOLUCION_EN_MARCHA =
  'La devolución íntegra de lo pagado se ha tramitado automáticamente. Puede tardar unos días en verse en tu cuenta.'
export const DEVOLUCION_COMPLETADA = 'Devolución íntegra completada. Puede tardar unos días en verse en tu cuenta.'
export const BONO_DEVUELTO = 'La sesión de tu bono vuelve a estar disponible.'
export const DEVOLUCION_PARCIAL = 'Devuelta la parte no usada. Puede tardar unos días en verse en tu cuenta.'

/** Para una reserva cancelada sin culpa del alumno. `estadoCobro` = estado del cobro de esa reserva, si lo hubo. */
export function textoDevolucion(estadoCobro: string | null | undefined, usaBono = false): string | null {
  if (estadoCobro === 'requiere_reembolso') return DEVOLUCION_EN_MARCHA
  if (estadoCobro === 'reembolsado') return DEVOLUCION_COMPLETADA
  if (estadoCobro === 'reembolsado_parcial') return DEVOLUCION_PARCIAL
  return usaBono ? BONO_DEVUELTO : null
}

/**
 * Estado de la devolución en un caso de Reclamaciones, según el cobro relacionado. Solo se afirma que está hecha
 * cuando el banco la ha confirmado. Los importes son los guardados en el cobro: aquí no se calcula nada.
 */
export function estadoDevolucionCaso(cobro: {
  estado?: string | null
  importe_centimos?: number | null
  importe_devolver_centimos?: number | null
} | null | undefined): { hecha: boolean; texto: string } | null {
  const estado = cobro?.estado
  if (estado !== 'requiere_reembolso' && estado !== 'reembolsado' && estado !== 'reembolsado_parcial') return null
  const centimos = cobro?.importe_devolver_centimos ?? cobro?.importe_centimos
  const importe = typeof centimos === 'number' ? ` de ${formatearEuros(centimos)}` : ''
  return estado === 'requiere_reembolso'
    ? { hecha: false, texto: `Devolución${importe} en trámite. Te avisaremos aquí cuando el banco la confirme.` }
    : { hecha: true, texto: `Devolución${importe} confirmada por el banco. Puede tardar unos días en verse en tu cuenta.` }
}

/** Mensaje tras cancelar el propio alumno (respuesta de cancelar_reserva). */
export function mensajeCancelacion(r: {
  cancelacion_tardia?: boolean
  usaba_bono?: boolean
  reembolso?: string | null
} | null | undefined): string {
  if (r?.cancelacion_tardia) {
    if (r.usaba_bono) return 'Reserva cancelada. Faltaban menos de 2 horas, así que la sesión de tu bono se considera consumida.'
    if (r.reembolso === 'sin_derecho') return 'Reserva cancelada. Faltaban menos de 2 horas, así que no tienes derecho a devolución.'
    return 'Reserva cancelada correctamente. Tu plaza ha quedado libre para otra persona.'
  }
  if (r?.reembolso === 'pendiente') return `Reserva cancelada. ${DEVOLUCION_EN_MARCHA}`
  if (r?.usaba_bono) return `Reserva cancelada. ${BONO_DEVUELTO}`
  return 'Reserva cancelada correctamente.'
}
