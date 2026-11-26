// Reprogramaciones (sql/100): qué ha cambiado y cuándo se puede pedir. Solo para MOSTRAR y avisar antes de enviar;
// las reglas las aplica el servidor (reprogramar_sesion). Si cambian los márgenes, hay que tocar los dos sitios.
import { msHastaInicio } from './plazoCancelacion.js'
import { formatearFechaParaMostrar } from './formatoFecha.js'

export const HORAS_CON_RESERVAS = 24
export const HORAS_SIN_RESERVAS = 2

const hora = (h) => String(h || '').slice(0, 5)
const lugar = (x) =>
  [x.direccion, x.ciudad, x.provincia && x.provincia !== x.ciudad ? x.provincia : null].filter(Boolean).join(', ')

const mismoPunto = (a, b) => a.lat === b.lat && a.lng === b.lng

/** Lista de cambios importantes entre dos versiones de la sesión: [{ campo, antes, despues }]. */
export function cambiosDeSesion(antes, despues) {
  const cambios = []
  if (antes.fecha !== despues.fecha) {
    cambios.push({ campo: 'Fecha', antes: formatearFechaParaMostrar(antes.fecha), despues: formatearFechaParaMostrar(despues.fecha) })
  }
  if (hora(antes.hora) !== hora(despues.hora)) {
    cambios.push({ campo: 'Hora', antes: hora(antes.hora), despues: hora(despues.hora) })
  }
  if (lugar(antes) !== lugar(despues) || !mismoPunto(antes, despues)) {
    const texto = lugar(despues)
    cambios.push({
      campo: 'Lugar',
      antes: lugar(antes),
      despues: texto === lugar(antes) ? `${texto} (otro punto del mapa)` : texto,
    })
  }
  return cambios
}

/** Mensaje de error antes de enviar, o null. `nueva` = { fecha, hora }. */
export function errorDeReprogramacion({ actual, nueva, hayCambioDeLugar, conReservas }, ahora = new Date()) {
  if (!nueva.fecha || !nueva.hora) return 'Indica la fecha y la hora.'
  const cambiaCuando = nueva.fecha !== actual.fecha || hora(nueva.hora) !== hora(actual.hora)
  if (!cambiaCuando && !hayCambioDeLugar) return 'No hay ningún cambio de fecha, hora o ubicación.'
  const horas = conReservas ? HORAS_CON_RESERVAS : HORAS_SIN_RESERVAS
  const margen = horas * 60 * 60 * 1000
  if (msHastaInicio(actual, ahora) < margen || msHastaInicio(nueva, ahora) < margen) {
    return conReservas
      ? `Con reservas, solo se puede reprogramar con al menos ${horas} horas de antelación (sobre el horario anterior y el nuevo). Si no puedes celebrarla, cancélala.`
      : `Solo se puede reprogramar con al menos ${horas} horas de antelación.`
  }
  return null
}
