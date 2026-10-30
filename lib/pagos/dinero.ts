// Importes de dinero. REGLA: dentro del módulo de pagos todo importe es un
// número entero de céntimos; nunca se calcula con euros decimales.

export type Reparto = {
  /** Lo que paga el alumno, en céntimos. */
  importe: number
  /** Parte de Ruleafit, en céntimos. */
  comision: number
  /** Parte del entrenador, en céntimos (importe - comision). */
  neto: number
}

function esEnteroNoNegativo(n: number): boolean {
  return Number.isInteger(n) && n >= 0
}

/**
 * Convierte euros (número o texto como "6", "6.5", "6,50") a céntimos enteros.
 * Lanza un error si el valor no es un importe válido o tiene más de 2 decimales.
 */
export function eurosACentimos(euros: number | string): number {
  const texto = typeof euros === 'number' ? String(euros) : euros.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new Error(`Importe no válido: "${euros}"`)
  }
  const [enteros, decimales = ''] = texto.split('.')
  return Number(enteros) * 100 + Number((decimales + '00').slice(0, 2))
}

/**
 * Reparte un importe entre Ruleafit y el entrenador.
 * La comisión se expresa en puntos básicos (1000 = 10 %) y se redondea al
 * céntimo más cercano, con las mitades hacia arriba. El neto es el resto, así
 * que comisión + neto siempre suman exactamente el importe.
 */
export function calcularReparto(importeCentimos: number, comisionBps: number): Reparto {
  if (!esEnteroNoNegativo(importeCentimos)) {
    throw new Error('El importe debe ser un número entero de céntimos, no negativo')
  }
  if (!Number.isInteger(comisionBps) || comisionBps < 0 || comisionBps > 10000) {
    throw new Error('La comisión debe estar entre 0 y 10000 puntos básicos')
  }
  const comision = Math.floor((importeCentimos * comisionBps + 5000) / 10000)
  return { importe: importeCentimos, comision, neto: importeCentimos - comision }
}

/** Formato para mostrar: 1250 -> "12,50 €". */
export function formatearEuros(centimos: number): string {
  if (!Number.isInteger(centimos)) throw new Error('Los céntimos deben ser un número entero')
  const signo = centimos < 0 ? '-' : ''
  const abs = Math.abs(centimos)
  const euros = Math.floor(abs / 100)
  const resto = String(abs % 100).padStart(2, '0')
  return `${signo}${euros},${resto} €`
}
