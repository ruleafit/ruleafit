// Contracargos (sql/117): validación de lo que el administrador anota. El dinero lo calcula SOLO la base de datos.
const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** «12,50» o «12.5» → 1250. Vacío → null (el contracargo es por todo el cobro). Cualquier otra cosa → undefined. */
export function importeEnCentimos(texto: unknown): number | null | undefined {
  const t = typeof texto === 'string' ? texto.trim() : ''
  if (!t) return null
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(t)
  if (!m) return undefined
  const centimos = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'))
  return centimos > 0 ? centimos : undefined
}

export type AltaContracargo = {
  p_pedido: string
  p_importe_centimos: number | null
  p_referencia: string | null
  p_motivo: string | null
  p_fecha_limite: string | null
}

export function validarAlta(entrada: unknown): { datos: AltaContracargo } | { error: string } {
  const d = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const pedido = texto(d.pedido)
  if (!/^\d{4}[0-9A-Za-z]{0,8}$/.test(pedido)) return { error: 'Escribe el número de pedido que indica el banco.' }
  const importe = importeEnCentimos(d.importe)
  if (importe === undefined) return { error: 'El importe no es válido (por ejemplo 12,50). Déjalo vacío si es todo el cobro.' }
  const limite = texto(d.fechaLimite)
  if (limite) {
    const fecha = FECHA.test(limite) ? new Date(`${limite}T00:00:00Z`) : null
    if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== limite) {
      return { error: 'La fecha límite no es válida.' }
    }
  }
  return {
    datos: {
      p_pedido: pedido,
      p_importe_centimos: importe,
      p_referencia: texto(d.referencia) || null,
      p_motivo: texto(d.motivo) || null,
      p_fecha_limite: limite || null,
    },
  }
}
