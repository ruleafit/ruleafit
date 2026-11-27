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
  // Retenciones de saldo de bonos (sql/107). Sin esa migración la lista queda vacía.
  const { data: abiertas } = await supabaseAdmin
    .from('bonos_retenciones')
    .select('id, organizador_id, motivo, created_at')
    .is('levantada_en', null)
  const ids = (abiertas || []).map((r) => r.organizador_id)
  const { data: perfiles } = ids.length ? await supabaseAdmin.from('perfiles').select('id, username').in('id', ids) : { data: [] }
  const nombres = new Map((perfiles || []).map((p) => [p.id, p.username]))
  const retenciones = (abiertas || []).map((r) => ({ ...r, username: nombres.get(r.organizador_id) || null }))
  return NextResponse.json({ alertas: alertas.data, paradas: paradas.data, retenciones })
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
  const { accion, id, que, organizador } = cuerpo || {}
  const esOrganizador = typeof organizador === 'string' && UUID.test(organizador)

  let llamada
  if (accion === 'resolver' && typeof id === 'string' && UUID.test(id)) {
    llamada = supabaseAdmin.rpc('resolver_alerta', { p_id: id })
  } else if (accion === 'parar' && FRENOS.includes(que)) {
    llamada = supabaseAdmin.rpc('parar_pagos', { p_que: que, p_motivo: 'Parada manual desde el panel' })
  } else if (accion === 'reanudar' && FRENOS.includes(que)) {
    llamada = supabaseAdmin.rpc('reanudar_pagos', { p_que: que })
  } else if (accion === 'levantar_retencion' && esOrganizador) {
    llamada = supabaseAdmin.rpc('levantar_retencion_bonos', { p_organizador: organizador })
  } else if (accion === 'devolver_bonos' && esOrganizador) {
    llamada = supabaseAdmin.rpc('devolver_bonos_de_organizador', { p_organizador: organizador, p_motivo: 'Incumplimiento del servicio' })
  } else {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { error } = await llamada
  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
