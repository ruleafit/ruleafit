// Textos del panel de liquidaciones. Los importes y las reglas están SOLO en sql/114: aquí no se calcula nada.

export const MOTIVOS_EXCLUSION: Record<string, string> = {
  sin_saldo: 'Nada que pagar ahora',
  datos_fiscales: 'Sin datos fiscales aprobados',
  sin_iban: 'Sin IBAN',
  bajo_minimo: 'No llega al mínimo: se acumula',
}

export const ESTADOS_LINEA: Record<string, string> = {
  pendiente: 'Pendiente de transferir',
  pagada: 'Transferida',
  anulada: 'Anulada: vuelve al saldo',
}

export const ACCIONES_LIQUIDACION = ['cerrar', 'pagada', 'anulada'] as const

export function esAccionLiquidacion(valor: unknown): valor is (typeof ACCIONES_LIQUIDACION)[number] {
  return typeof valor === 'string' && (ACCIONES_LIQUIDACION as readonly string[]).includes(valor)
}
