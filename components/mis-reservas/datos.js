import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

// Tipo de reserva para adaptar los textos de cancelación: con bono, de pago (solo cuando los pagos
// online están activos: hoy nadie paga) o gratuita.
export function tipoReserva(reserva, clase) {
  if (reserva?.bono_cliente_id) return 'bono'
  if (PAGOS_VISIBLES && Number(clase?.precio) > 0) return 'pago'
  return 'gratuita'
}

export function claveFechaHora(clase) {
  return `${clase.fecha} ${String(clase.hora).slice(0, 5)}`
}

export function etiquetaCuentaAtras(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(fecha + 'T00:00:00')
  const dias = Math.round((objetivo - hoy) / 86400000)

  if (dias <= 0) return 'Es hoy'
  if (dias === 1) return 'Es mañana'
  return `Faltan ${dias} días`
}
