import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FRENOS = ['cobros', 'devoluciones']

// Alertas operativas y frenos (sql/099). Solo administradores. Aquí NO se activan los pagos.
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const [alertas, paradas] = await Promise.all([
    supabaseAdmin
      .from('alertas_operativas')
      .select('id, tipo, clave, gravedad, detalle, veces, primera_en, ultima_en, resuelta_en')
      .order('ultima_en', { ascending: false })
      .limit(100),
    supabaseAdmin.rpc('estado_paradas'),
  ])
  if (alertas.error || paradas.error) {
    return NextResponse.json({ error: 'No se pudieron leer las alertas' }, { status: 500 })
  }
  return NextResponse.json({ alertas: alertas.data, paradas: paradas.data })
}

// { accion: 'resolver', id } | { accion: 'parar' | 'reanudar', que: 'cobros' | 'devoluciones' }
export async function PATCH(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  let cuerpo
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }
  const { accion, id, que } = cuerpo || {}

  let llamada
  if (accion === 'resolver' && typeof id === 'string' && UUID.test(id)) {
    llamada = supabaseAdmin.rpc('resolver_alerta', { p_id: id })
  } else if (accion === 'parar' && FRENOS.includes(que)) {
    llamada = supabaseAdmin.rpc('parar_pagos', { p_que: que, p_motivo: 'Parada manual desde el panel' })
  } else if (accion === 'reanudar' && FRENOS.includes(que)) {
    llamada = supabaseAdmin.rpc('reanudar_pagos', { p_que: que })
  } else {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { error } = await llamada
  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
