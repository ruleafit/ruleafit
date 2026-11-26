// Proceso de devoluciones pendientes (sql/096). Lo usan /api/payments/devolver (banco real) y el simulador de TPV
// (banco simulado, solo local y Preview): la lógica es UNA. Solo servidor: recibe el cliente de servicio.
//
// Cada cobro se reclama de forma atómica y solo pasa a 'reembolsado' si el banco confirma (0900). Una respuesta
// dudosa deja la devolución 'en_curso' para revisión manual.
// PARADA SEGURA (sql/099): antes de cada devolución se lee el freno; si está puesto, o no se puede leer, no se pide
// nada al banco. Una respuesta dudosa activa el freno y corta la tanda.
import { solicitarDevolucion, type ConfigRedsys } from './redsys.ts'
import { ALERTAS } from './alertas.ts'
import { registrarAlerta } from './registrarAlerta.ts'

export const MAX_POR_LLAMADA = 10

type Respuesta = { data?: any; error: { code?: string } | null }
export type ClienteAdmin = {
  rpc: (nombre: string, args?: Record<string, unknown>) => PromiseLike<Respuesta>
}

export type ResultadoProceso = {
  status: number
  cuerpo: {
    ok?: boolean
    error?: string
    parado?: boolean
    completadas: number
    rechazadas: number
    dudosas: number
  }
}

export async function procesarDevoluciones(
  admin: ClienteAdmin,
  cfg: ConfigRedsys,
  llamar: typeof fetch = fetch
): Promise<ResultadoProceso> {
  const resumen = { completadas: 0, rechazadas: 0, dudosas: 0 }
  for (let i = 0; i < MAX_POR_LLAMADA; i++) {
    const { data: paradas, error: errParadas } = await admin.rpc('estado_paradas')
    if (errParadas || !paradas) {
      console.error('estado_paradas no disponible:', errParadas?.code)
      return { status: 503, cuerpo: { error: 'No se puede comprobar la parada segura', ...resumen } }
    }
    if (paradas.devoluciones) {
      return { status: 200, cuerpo: { ok: true, parado: true, ...resumen } }
    }

    const { data, error } = await admin.rpc('reclamar_devolucion')
    if (error) {
      console.error('reclamar_devolucion falló:', error.code)
      await registrarAlerta(admin, ALERTAS.devolucionErrorBase(error.code))
      return { status: 500, cuerpo: { error: 'Error al reclamar', ...resumen } }
    }
    if (data?.resultado !== 'reclamada') break

    const r = await solicitarDevolucion(cfg, { pedido: data.pedido, importeCentimos: data.importe_centimos }, llamar)
    if (r.resultado === 'desconocido') {
      // No se sabe si el banco devolvió el dinero: se deja en curso, a revisar a mano.
      console.error('Devolución dudosa, revisar a mano. cobro:', data.cobro_id, r.detalle)
      resumen.dudosas++
      await registrarAlerta(admin, ALERTAS.devolucionDudosa(data.cobro_id))
      break
    }
    const { error: errCierre } = await admin.rpc('completar_devolucion', {
      p_cobro_id: data.cobro_id,
      p_confirmada: r.resultado === 'confirmada',
      p_codigo_respuesta: r.codigoRespuesta,
      p_detalle: r.detalle ?? null,
    })
    if (errCierre) {
      console.error('completar_devolucion falló, revisar a mano. cobro:', data.cobro_id, errCierre.code)
      resumen.dudosas++
      await registrarAlerta(admin, ALERTAS.devolucionSinCerrar(data.cobro_id))
      break
    }
    if (r.resultado === 'confirmada') resumen.completadas++
    else {
      resumen.rechazadas++
      await registrarAlerta(admin, ALERTAS.devolucionRechazada(data.cobro_id, r.codigoRespuesta))
    }
  }
  return { status: 200, cuerpo: { ok: true, ...resumen } }
}
