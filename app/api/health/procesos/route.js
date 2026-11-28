import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// Vigilancia externa de los procesos programados: 200 si el cron de alertas (cada 5 min) ha revisado hace poco y 503
// si no (cron parado, secreto mal puesto o web sin responder). El correo de alertas no puede avisar de su propia
// caída; esto sí. Solo dice «bien o mal». Antes de programar el cron responde 503.
export const dynamic = 'force-dynamic'

const MARGEN_MS = 20 * 60 * 1000

export async function GET() {
  const cabeceras = { 'Cache-Control': 'no-store' }
  let ok = false
  try {
    const { data, error } = await supabaseAdmin.from('config_pagos').select('ultima_revision_en').maybeSingle()
    ok = !error && !!data?.ultima_revision_en && Date.now() - Date.parse(data.ultima_revision_en) < MARGEN_MS
  } catch {
    ok = false
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: cabeceras })
}
