// «Mis ingresos» (sql/105, mis_ingresos()): textos y orden de lo que ve el organizador.
// Aquí no se calcula ningún importe: todos llegan de la base de datos.

export const SITUACIONES = {
  pendiente: 'Pendiente',
  disponible: 'Disponible',
  retenido: 'Retenido por reclamación',
  en_devolucion: 'En devolución al alumno',
  devuelto: 'Devuelto al alumno',
} as const

export type Situacion = keyof typeof SITUACIONES

export const SALDOS = [
  { clave: 'pendiente_centimos', titulo: 'Pendiente', ayuda: 'Sesiones y bonos pagados que aún no han cumplido el plazo.' },
  { clave: 'disponible_centimos', titulo: 'Disponible', ayuda: 'Ya es tuyo y entrará en la próxima liquidación.' },
  { clave: 'liquidado_centimos', titulo: 'Liquidado', ayuda: 'Transferido a tu cuenta.' },
] as const

export type Resumen = {
  retenido_centimos?: number
  en_devolucion_centimos?: number
  disponible_centimos?: number
}

/** Avisos que acompañan a los saldos, solo cuando hay algo que explicar. */
export function avisosDeSaldo(r: Resumen, euros: (c: number) => string): string[] {
  const avisos: string[] = []
  if ((r.retenido_centimos ?? 0) > 0) {
    avisos.push(`${euros(r.retenido_centimos!)} retenidos mientras se revisa una reclamación. No cuentan como pendiente ni disponible.`)
  }
  if ((r.en_devolucion_centimos ?? 0) > 0) {
    avisos.push(`${euros(r.en_devolucion_centimos!)} se están devolviendo a alumnos y no se te abonarán.`)
  }
  if ((r.disponible_centimos ?? 0) < 0) {
    avisos.push('Tu saldo disponible es negativo por una devolución posterior: se compensará con tus próximos ingresos.')
  }
  return avisos
}

/** Cuándo pasa a disponible un cobro pendiente. `libera_desde` es la fecha que calcula la base de datos. */
export function textoLiberacion(situacion: string, liberaDesde: string | null | undefined, ahora = new Date()): string | null {
  if (situacion !== 'pendiente' || !liberaDesde) return null
  const fecha = new Date(liberaDesde)
  if (Number.isNaN(fecha.getTime())) return null
  if (fecha <= ahora) return 'Se libera en los próximos minutos.'
  // Por partes: el formato de fecha en español no siempre rellena con ceros.
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(fecha)
  const p = (tipo: string) => String(partes.find((x) => x.type === tipo)?.value ?? '').padStart(2, '0')
  return `Disponible a partir del ${p('day')}/${p('month')} a las ${p('hour')}:${p('minute')}.`
}
