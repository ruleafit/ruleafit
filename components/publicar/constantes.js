import { claseYaPaso } from '../../lib/ventanaEdicionClase'

export const CATEGORIAS = [
  'Fuerza / funcional',
  'Cardio',
  'Yoga / Pilates / movilidad',
  'Otros',
]

export const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

// El formulario se abre sin ciudad: quien publica elige la suya (cualquier
// ciudad de España) con el autocompletado. Hasta entonces el mapa muestra España.
export const CIUDAD_POR_DEFECTO = ''

export const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
export const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
export const ayudaClass = 'mt-1 text-xs text-[#6B7355]'
export const tarjetaClass = 'corte-card border border-[#E2E6CF] bg-white p-5 shadow-sm sm:p-6'
export const botonPrimarioClass =
  'mt-2 w-full corte-btn bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

// Fecha propuesta al copiar una sesión: el mismo día de la semana siguiente a la
// fecha de la sesión copiada y, si aun así ya ha pasado (se copia una sesión
// antigua), la primera semana posterior que sea futura. Se calcula con el
// calendario sin zona horaria (UTC) para que no se desplace un día.
export function proponerFechaCopia(fechaIso, hora) {
  const [anio, mes, dia] = String(fechaIso).split('-').map(Number)
  if (!anio || !mes || !dia) return ''
  let semanas = 1
  let propuesta = ''
  do {
    const d = new Date(Date.UTC(anio, mes - 1, dia + 7 * semanas))
    propuesta = d.toISOString().slice(0, 10)
    semanas += 1
  } while (claseYaPaso({ fecha: propuesta, hora }) && semanas < 260)
  return propuesta
}
