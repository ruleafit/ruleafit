// Plazo de cancelación GRATUITA de una reserva (solo para MOSTRARLO; la regla real la aplica el servidor).
//
// Regla efectiva en la base de datos (`cancelar_reserva`, sql/087_cancelacion_tardia.sql):
//   - se puede cancelar en cualquier momento ANTES de que empiece la sesión;
//   - si (inicio de la sesión - ahora) >= 2 horas, ambos en hora de Madrid (comparación de hora
//     local sin zona, con segundos), es una cancelación a tiempo: con exactamente 2 h todavía lo es;
//   - con menos de 2 h es tardía: se cancela y se libera la plaza, pero sin derecho a devolución y,
//     si la reserva usaba un bono, la sesión del bono queda consumida;
//   - es la misma regla para sesiones gratuitas, de pago y con bono.
// Aquí se replica el mismo cálculo (hora local de Madrid, con segundos) para que lo que lee el
// usuario coincida con lo que hará el servidor. Si cambia la política, hay que tocar SOLO
// PLAZO_CANCELACION_HORAS y la barrera de SQL a la vez.

export const PLAZO_CANCELACION_HORAS = 2

const MS_HORA = 60 * 60 * 1000

// Hora local de Madrid "ahora" como milisegundos de pared (se compara con el inicio de la sesión,
// que también es hora local sin zona). `ahora` es opcional para poder probarlo.
function ahoraMadridComoMs(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora)
  const n = (tipo) => Number(partes.find((p) => p.type === tipo)?.value)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
}

function inicioComoMs(fecha, hora) {
  if (!fecha || !hora) return null
  const [anio, mes, dia] = String(fecha).split('-').map(Number)
  const [h, m, s] = String(hora).split(':').map(Number)
  if (!anio || !mes || !dia || Number.isNaN(h) || Number.isNaN(m)) return null
  return Date.UTC(anio, mes - 1, dia, h, m, s || 0)
}

// Milisegundos que faltan para que empiece la sesión (hora de Madrid, con segundos, igual que el servidor);
// negativo si ya empezó; null sin datos. Solo lectura de la misma referencia temporal: no cambia ninguna regla.
export function msHastaInicio({ fecha, hora }, ahora = new Date()) {
  const inicio = inicioComoMs(fecha, hora)
  return inicio === null ? null : inicio - ahoraMadridComoMs(ahora)
}

const dos = (n) => String(n).padStart(2, '0')

// Estado del plazo respecto a una sesión:
//   'abierto'  faltan 2 h o más: cancelación gratuita hasta `limite`
//   'cerrado'  faltan menos de 2 h (o ya empezó): ya no hay cancelación gratuita (se puede cancelar
//              hasta el comienzo, pero sin devolución). `yaEmpezada` indica que ya no se puede cancelar.
// `limite` = { dia: 'DD/MM', hora: 'HH:MM' } en hora de Madrid, o null si no hay datos.
export function plazoCancelacion({ fecha, hora }, ahora = new Date()) {
  const inicio = inicioComoMs(fecha, hora)
  if (inicio === null) return { estado: 'desconocido', limite: null, yaEmpezada: false }

  const limiteMs = inicio - PLAZO_CANCELACION_HORAS * MS_HORA
  const l = new Date(limiteMs) // Date en UTC usado solo como calendario de pared
  const limite = {
    dia: `${dos(l.getUTCDate())}/${dos(l.getUTCMonth() + 1)}`,
    hora: `${dos(l.getUTCHours())}:${dos(l.getUTCMinutes())}`,
  }
  const ahoraMs = ahoraMadridComoMs(ahora)
  return {
    estado: inicio - ahoraMs >= PLAZO_CANCELACION_HORAS * MS_HORA ? 'abierto' : 'cerrado',
    limite,
    yaEmpezada: inicio < ahoraMs,
  }
}
