import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { esAccionLiquidacion } from '../../../../lib/pagos/liquidaciones.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIN_CACHE = { 'Cache-Control': 'no-store' }

function noAutorizado() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
}

function fallo(error) {
  const legible = ['P0001', 'P0002'].includes(error.code)
  return NextResponse.json({ error: legible ? error.message : 'No se ha podido completar' }, { status: legible ? 400 : 500 })
}

// Previsión del último corte y transferencias registradas (sql/114). Solo administradores.
export async function GET(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { data, error } = await supabaseAdmin.rpc('panel_liquidaciones')
  if (error) return NextResponse.json({ error: 'No se pudieron leer las liquidaciones' }, { status: 500 })
  return NextResponse.json(data, { headers: SIN_CACHE })
}

// { accion: 'cerrar' } | { accion: 'pagada' | 'anulada', linea }. No envía dinero: lo anota.
export async function PATCH(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { accion, linea } = (await request.json().catch(() => null)) || {}
  if (!esAccionLiquidacion(accion) || (accion !== 'cerrar' && !UUID.test(String(linea)))) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  const { error } =
    accion === 'cerrar'
      ? await supabaseAdmin.rpc('cerrar_liquidacion')
      : await supabaseAdmin.rpc('marcar_linea_liquidacion', { p_linea: linea, p_estado: accion })
  return error ? fallo(error) : NextResponse.json({ ok: true })
}

// { linea } → titular, IBAN e importe de UNA transferencia pendiente. El IBAN solo se descifra aquí y no se registra.
export async function POST(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { linea } = (await request.json().catch(() => null)) || {}
  if (!UUID.test(String(linea))) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  const { data, error } = await supabaseAdmin.rpc('datos_transferencia', { p_linea: linea })
  return error ? fallo(error) : NextResponse.json(data, { headers: SIN_CACHE })
}
