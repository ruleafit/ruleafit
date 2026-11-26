import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../../lib/secretoCron'
import { configRedsysDesdeEntorno, solicitarDevolucion } from '../../../../lib/pagos/redsys.ts'
import { ALERTAS } from '../../../../lib/pagos/alertas.ts'
import { registrarAlerta } from '../../../../lib/pagos/registrarAlerta.ts'

// Procesa devoluciones pendientes (cobros en 'requiere_reembolso'). Solo la
// puede llamar el cron (CRON_SECRET). Cada cobro se reclama de forma atómica en
// la base de datos y solo pasa a 'reembolsado' si el banco confirma (0900).
// Una respuesta dudosa deja la devolución 'en_curso' para revisión manual.
// PARADA SEGURA (sql/099): antes de cada devolución se lee el freno; si está puesto, o no se puede leer, no se
// pide nada al banco. Una respuesta dudosa activa el freno y corta la tanda.
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
    await registrarAlerta(supabaseAdmin, ALERTAS.devolucionSinConfigurar())
    return NextResponse.json({ error: 'No configurado' }, { status: 503 })
  }

  const resumen = { completadas: 0, rechazadas: 0, dudosas: 0 }
  for (let i = 0; i < MAX_POR_LLAMADA; i++) {
    const { data: paradas, error: errParadas } = await supabaseAdmin.rpc('estado_paradas')
    if (errParadas || !paradas) {
      console.error('estado_paradas no disponible:', errParadas?.code)
      return NextResponse.json({ error: 'No se puede comprobar la parada segura', ...resumen }, { status: 503 })
    }
    if (paradas.devoluciones) {
      return NextResponse.json({ ok: true, parado: true, ...resumen })
    }

    const { data, error } = await supabaseAdmin.rpc('reclamar_devolucion')
    if (error) {
      console.error('reclamar_devolucion falló:', error.code)
      await registrarAlerta(supabaseAdmin, ALERTAS.devolucionErrorBase(error.code))
      return NextResponse.json({ error: 'Error al reclamar', ...resumen }, { status: 500 })
    }
    if (data?.resultado !== 'reclamada') break

    const r = await solicitarDevolucion(cfg, { pedido: data.pedido, importeCentimos: data.importe_centimos })
    if (r.resultado === 'desconocido') {
      // No se sabe si el banco devolvió el dinero: se deja en curso, a revisar a mano.
      console.error('Devolución dudosa, revisar a mano. cobro:', data.cobro_id, r.detalle)
      resumen.dudosas++
      await registrarAlerta(supabaseAdmin, ALERTAS.devolucionDudosa(data.cobro_id))
      break
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
      await registrarAlerta(supabaseAdmin, ALERTAS.devolucionSinCerrar(data.cobro_id))
      break
    }
    if (r.resultado === 'confirmada') resumen.completadas++
    else {
      resumen.rechazadas++
      await registrarAlerta(supabaseAdmin, ALERTAS.devolucionRechazada(data.cobro_id, r.codigoRespuesta))
    }
  }
  return NextResponse.json({ ok: true, ...resumen })
}
