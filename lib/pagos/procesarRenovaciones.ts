// Cobro mensual de la suscripción Pro (sql/107). Lo usan /api/payments/pro/renovar (banco real, cron) y el
// simulador de TPV (banco simulado). La base de datos decide a quién toca, caduca lo vencido y respeta la parada
// segura. Una respuesta dudosa NO se reintenta sola.
import { nuevoPedido, solicitarCobroRecurrente, type ConfigRedsys } from './redsys.ts'
import { ALERTAS } from './alertas.ts'
import { registrarAlerta } from './registrarAlerta.ts'
import type { ClienteAdmin } from './procesarDevoluciones.ts'

export const MAX_RENOVACIONES_POR_LLAMADA = 20

export type ResultadoRenovaciones = {
  status: number
  cuerpo: { ok?: boolean; error?: string; parado?: boolean; cobradas: number; denegadas: number; dudosas: number }
}

export async function procesarRenovaciones(
  admin: ClienteAdmin,
  cfg: ConfigRedsys,
  llamar: typeof fetch = fetch,
  pedido: () => string = nuevoPedido
): Promise<ResultadoRenovaciones> {
  const resumen = { cobradas: 0, denegadas: 0, dudosas: 0 }
  for (let i = 0; i < MAX_RENOVACIONES_POR_LLAMADA; i++) {
    const { data, error } = await admin.rpc('reclamar_renovacion_pro', { p_pedido: pedido() })
    if (error) {
      console.error('reclamar_renovacion_pro falló:', error.code)
      await registrarAlerta(admin, ALERTAS.renovacionError(error.code))
      return { status: 500, cuerpo: { error: 'Error al reclamar', ...resumen } }
    }
    if (data?.resultado === 'parado') return { status: 200, cuerpo: { ok: true, parado: true, ...resumen } }
    if (data?.resultado !== 'reclamada') break

    const r = await solicitarCobroRecurrente(
      cfg,
      {
        pedido: data.pedido,
        importeCentimos: data.importe_centimos,
        identificadorTarjeta: data.identificador,
        cofTxnid: data.cof_txnid ?? null,
      },
      llamar
    )
    if (r.resultado === 'desconocido') {
      console.error('Renovación Pro dudosa, revisar a mano. pedido:', data.pedido, r.detalle)
      resumen.dudosas++
      await admin.rpc('marcar_pago_pro_dudoso', { p_pedido: data.pedido })
      await registrarAlerta(admin, ALERTAS.renovacionDudosa(data.pedido))
      break
    }
    const { error: errCierre } = await admin.rpc('confirmar_pago_pro', {
      p_pedido: data.pedido,
      p_importe_centimos: data.importe_centimos,
      p_autorizado: r.resultado === 'cobrado',
      p_codigo_respuesta: r.codigoRespuesta,
    })
    if (errCierre) {
      console.error('confirmar_pago_pro falló, revisar a mano. pedido:', data.pedido, errCierre.code)
      resumen.dudosas++
      await registrarAlerta(admin, ALERTAS.renovacionDudosa(data.pedido))
      break
    }
    if (r.resultado === 'cobrado') resumen.cobradas++
    else resumen.denegadas++
  }
  return { status: 200, cuerpo: { ok: true, ...resumen } }
}
