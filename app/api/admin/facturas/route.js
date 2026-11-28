import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const noAutorizado = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 })

// Facturas y borradores (sql/116). Solo administradores.
export async function GET(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const [facturas, config] = await Promise.all([
    supabaseAdmin.from('facturas').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('config_pagos').select('facturas_validadas').single(),
  ])
  if (facturas.error || config.error) return NextResponse.json({ error: 'No se pudieron leer las facturas' }, { status: 500 })
  // Facturas de comisión con algún cobro devuelto después: hace falta una rectificativa (todavía manual).
  const { data: devueltos } = await supabaseAdmin
    .from('cobros')
    .select('factura_comision_id')
    .not('factura_comision_id', 'is', null)
    .in('estado', ['requiere_reembolso', 'reembolsado', 'reembolsado_parcial'])
  const rectificar = new Set((devueltos || []).map((c) => c.factura_comision_id))
  const ids = [...new Set(facturas.data.map((f) => f.usuario_id))]
  const { data: perfiles } = ids.length ? await supabaseAdmin.from('perfiles').select('id, username').in('id', ids) : { data: [] }
  const nombres = new Map((perfiles || []).map((p) => [p.id, p.username]))
  return NextResponse.json(
    { validadas: config.data.facturas_validadas, facturas: facturas.data.map((f) => ({ ...f, username: nombres.get(f.usuario_id) || null, rectificar: rectificar.has(f.id) })) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// { accion: 'generar' } rehace los borradores; { accion: 'emitir', factura } numera una (solo si está validado).
export async function PATCH(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { accion, factura } = (await request.json().catch(() => null)) || {}
  if (!['generar', 'emitir'].includes(accion) || (accion === 'emitir' && !UUID.test(String(factura)))) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  const { error } =
    accion === 'generar'
      ? await supabaseAdmin.rpc('generar_borradores_facturas')
      : await supabaseAdmin.rpc('emitir_factura', { p_id: factura })
  if (error) {
    const legible = error.code === 'P0001'
    return NextResponse.json({ error: legible ? error.message : 'No se ha podido completar' }, { status: legible ? 400 : 500 })
  }
  return NextResponse.json({ ok: true })
}
