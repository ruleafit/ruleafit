import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'

// Punto de salud para la vigilancia externa (UptimeRobot o similar): responde 200
// si la web y la base de datos contestan, y 503 si no. No devuelve datos internos.
export const dynamic = 'force-dynamic'

export async function GET() {
  const cabeceras = { 'Cache-Control': 'no-store' }
  try {
    const { error } = await supabase.from('clases').select('id', { count: 'exact', head: true }).limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true }, { headers: cabeceras })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: cabeceras })
  }
}
