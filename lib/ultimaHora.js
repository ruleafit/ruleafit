// Reservas de última hora: aviso adicional cuando faltan MENOS de 30 minutos y la sesión aún no ha empezado.
// Solo informa en la interfaz; la regla real (no reservar si ya empezó, plaza libre, sin duplicados) la aplica
// siempre el servidor en reservar_clase. Mismo cálculo de hora de Madrid que C33 (lib/plazoCancelacion.js).
import { msHastaInicio } from './plazoCancelacion.js'

export const UMBRAL_ULTIMA_HORA_MIN = 30

export function esReservaDeUltimaHora(clase, ahora = new Date()) {
  const ms = msHastaInicio(clase, ahora)
  return ms !== null && ms > 0 && ms < UMBRAL_ULTIMA_HORA_MIN * 60 * 1000
}
