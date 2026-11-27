import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { esEstadoIncidencia } from '../../../../lib/pagos/incidencias.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Lista las reclamaciones económicas con el nombre de usuario y el estado del cobro. Solo administradores.
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: casos, error } = await supabaseAdmin
    .from('incidencias_pago')
    .select(
      'id, numero, usuario_id, reserva_id, cobro_id, clase_titulo, clase_fecha, tipo, descripcion, estado, respuesta, created_at, updated_at, cobros(estado, importe_centimos, pedido_redsys)'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'No se pudieron leer las reclamaciones' }, { status: 500 })
  }

  const ids = [...new Set(casos.map((c) => c.usuario_id).filter(Boolean))]
  const { data: perfiles } = ids.length
    ? await supabaseAdmin.from('perfiles').select('id, username').in('id', ids)
    : { data: [] }
  const usernames = new Map((perfiles || []).map((p) => [p.id, p.username]))

  return NextResponse.json({
    incidencias: casos.map((c) => ({ ...c, username: usernames.get(c.usuario_id) || null })),
  })
}

// Cambia el estado y responde: { id, estado, respuesta? }. No mueve dinero.
// Con { id, accion: 'devolver', respuesta } marca el pago para devolución y cierra el caso (sql/105).
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

  const { id, estado, respuesta, accion } = cuerpo || {}
  const devolver = accion === 'devolver'
  if (
    typeof id !== 'string' ||
    !UUID.test(id) ||
    (accion != null && !devolver) ||
    (!devolver && !esEstadoIncidencia(estado)) ||
    (respuesta != null && (typeof respuesta !== 'string' || respuesta.length > 1000))
  ) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { error } = devolver
    ? await supabaseAdmin.rpc('devolver_y_cerrar_incidencia', { p_id: id, p_respuesta: respuesta ?? null })
    : await supabaseAdmin.rpc('actualizar_incidencia', { p_id: id, p_estado: estado, p_respuesta: respuesta ?? null })
  if (error) {
    const legible = ['P0001', 'P0002', '23505'].includes(error.code)
    const texto =
      error.code === '23505' ? 'Ya hay otro caso abierto por ese motivo para la misma reserva.' : error.message
    return NextResponse.json({ error: legible ? texto : 'No se pudo actualizar' }, { status: legible ? 400 : 500 })
  }
  return NextResponse.json({ ok: true })
}
