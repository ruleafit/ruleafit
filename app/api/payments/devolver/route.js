import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../../lib/secretoCron'
import { configRedsysDesdeEntorno } from '../../../../lib/pagos/redsys.ts'
import { ALERTAS } from '../../../../lib/pagos/alertas.ts'
import { registrarAlerta } from '../../../../lib/pagos/registrarAlerta.ts'
import { procesarDevoluciones } from '../../../../lib/pagos/procesarDevoluciones.ts'

// Procesa devoluciones pendientes (cobros en 'requiere_reembolso'). Solo la puede llamar el cron (CRON_SECRET).
// La lógica (incluida la parada segura) está en lib/pagos/procesarDevoluciones.ts.
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

  const { status, cuerpo } = await procesarDevoluciones(supabaseAdmin, cfg)
  return NextResponse.json(cuerpo, { status })
}
