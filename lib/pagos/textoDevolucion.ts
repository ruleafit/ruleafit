// Qué se le dice al alumno sobre su dinero cuando una reserva se cancela. La devolución se pone en marcha sola
// (el cobro pasa a 'requiere_reembolso'); no se afirma que el dinero ya haya llegado hasta que el banco confirma.

export const DEVOLUCION_EN_MARCHA =
  'La devolución íntegra de lo pagado se ha tramitado automáticamente. Puede tardar unos días en verse en tu cuenta.'
export const DEVOLUCION_COMPLETADA = 'Devolución íntegra completada. Puede tardar unos días en verse en tu cuenta.'
export const BONO_DEVUELTO = 'La sesión de tu bono vuelve a estar disponible.'

/** Para una reserva cancelada sin culpa del alumno. `estadoCobro` = estado del cobro de esa reserva, si lo hubo. */
export function textoDevolucion(estadoCobro: string | null | undefined, usaBono = false): string | null {
  if (estadoCobro === 'requiere_reembolso') return DEVOLUCION_EN_MARCHA
  if (estadoCobro === 'reembolsado') return DEVOLUCION_COMPLETADA
  return usaBono ? BONO_DEVUELTO : null
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
