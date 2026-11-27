import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../../../lib/secretoCron'
import { configRedsysDesdeEntorno } from '../../../../../lib/pagos/redsys.ts'
import { procesarRenovaciones } from '../../../../../lib/pagos/procesarRenovaciones.ts'

// Cobro mensual de Pro. Solo la puede llamar el cron (CRON_SECRET). Mientras PAGOS_ACTIVOS no sea "true" no hace nada.
export async function POST(request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (process.env.PAGOS_ACTIVOS !== 'true') {
    return NextResponse.json({ error: 'Pagos desactivados' }, { status: 503 })
  }
  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    console.error('Renovaciones Pro: Redsys sin configurar:', e.message)
    return NextResponse.json({ error: 'No configurado' }, { status: 503 })
  }
  const { status, cuerpo } = await procesarRenovaciones(supabaseAdmin, cfg)
  return NextResponse.json(cuerpo, { status })
}
