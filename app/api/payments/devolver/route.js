import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../../lib/secretoCron'
import { configRedsysDesdeEntorno, solicitarDevolucion } from '../../../../lib/pagos/redsys.ts'

// Procesa devoluciones pendientes (cobros en 'requiere_reembolso'). Solo la
// puede llamar el cron (CRON_SECRET). Cada cobro se reclama de forma atómica en
// la base de datos y solo pasa a 'reembolsado' si el banco confirma (0900).
// Una respuesta dudosa deja la devolución 'en_curso' para revisión manual.
const MAX_POR_LLAMADA = 10

export async function POST(request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    console.error('Devoluciones: Redsys sin configurar:', e.message)
    return NextResponse.json({ error: 'No configurado' }, { status: 503 })
  }

  const resumen = { completadas: 0, rechazadas: 0, dudosas: 0 }
  for (let i = 0; i < MAX_POR_LLAMADA; i++) {
    const { data, error } = await supabaseAdmin.rpc('reclamar_devolucion')
    if (error) {
      console.error('reclamar_devolucion falló:', error.code)
      return NextResponse.json({ error: 'Error al reclamar', ...resumen }, { status: 500 })
    }
    if (data?.resultado !== 'reclamada') break

    const r = await solicitarDevolucion(cfg, { pedido: data.pedido, importeCentimos: data.importe_centimos })
    if (r.resultado === 'desconocido') {
      // No se sabe si el banco devolvió el dinero: se deja en curso, a revisar a mano.
      console.error('Devolución dudosa, revisar a mano. cobro:', data.cobro_id, r.detalle)
      resumen.dudosas++
      continue
    }
    const { error: errCierre } = await supabaseAdmin.rpc('completar_devolucion', {
      p_cobro_id: data.cobro_id,
      p_confirmada: r.resultado === 'confirmada',
      p_codigo_respuesta: r.codigoRespuesta,
      p_detalle: r.detalle ?? null,
    })
    if (errCierre) {
      console.error('completar_devolucion falló, revisar a mano. cobro:', data.cobro_id, errCierre.code)
      resumen.dudosas++
      continue
    }
    if (r.resultado === 'confirmada') resumen.completadas++
    else resumen.rechazadas++
  }
  return NextResponse.json({ ok: true, ...resumen })
}
