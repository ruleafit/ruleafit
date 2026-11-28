import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { validarAlta } from '../../../../lib/pagos/contracargos.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESULTADOS = ['ganado', 'perdido', 'anulado']
// Mensajes de la base de datos pensados para mostrarse (raise exception de sql/117).
const VISIBLES = ['P0001', 'P0002']

// Contracargos (sql/117). Solo administradores. No habla con el banco: se anota lo que el banco comunica.
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('contracargos')
    .select(
      'id, importe_centimos, estado, referencia_banco, motivo, fecha_limite, descontado_centimos, creado_en, resuelto_en, cobros(pedido_redsys, importe_centimos, estado, tipo, clase_titulo, entrenador_id)'
    )
    .order('creado_en', { ascending: false })
    .limit(100)
  if (error) {
    return NextResponse.json({ error: 'No se pudieron leer los contracargos' }, { status: 500 })
  }
  const ids = [...new Set(data.map((k) => k.cobros?.entrenador_id).filter(Boolean))]
  const { data: perfiles } = ids.length ? await supabaseAdmin.from('perfiles').select('id, username').in('id', ids) : { data: [] }
  const nombres = new Map((perfiles || []).map((p) => [p.id, p.username]))
  return NextResponse.json({
    contracargos: data.map((k) => ({ ...k, username: nombres.get(k.cobros?.entrenador_id) || null })),
  })
}

// { accion: 'registrar', pedido, importe, referencia, motivo, fechaLimite } | { accion: 'resolver', id, resultado }
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
  const { accion, id, resultado } = cuerpo || {}

  let llamada
  if (accion === 'registrar') {
    const alta = validarAlta(cuerpo)
    if (alta.error) return NextResponse.json({ error: alta.error }, { status: 400 })
    llamada = supabaseAdmin.rpc('registrar_contracargo', alta.datos)
  } else if (accion === 'resolver' && typeof id === 'string' && UUID.test(id) && RESULTADOS.includes(resultado)) {
    llamada = supabaseAdmin.rpc('resolver_contracargo', { p_id: id, p_resultado: resultado })
  } else {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { data, error } = await llamada
  if (error) {
    if (VISIBLES.includes(error.code)) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Contracargos:', error.code)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, resultado: data })
}
