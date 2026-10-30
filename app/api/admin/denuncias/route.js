import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'

const ESTADOS = ['pendiente', 'revisada', 'descartada']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Lista las denuncias con los nombres de usuario y el título de la sesión.
// Solo administradores (ver lib/adminAuth.js).
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: denuncias, error } = await supabaseAdmin
    .from('denuncias')
    .select('id, denunciante_id, tipo, objetivo_id, usuario_denunciado_id, motivo, comentario, estado, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'No se pudieron leer las denuncias' }, { status: 500 })
  }

  const idsUsuarios = [
    ...new Set(denuncias.flatMap((d) => [d.denunciante_id, d.usuario_denunciado_id]).filter(Boolean)),
  ]
  const idsSesiones = [...new Set(denuncias.filter((d) => d.tipo === 'sesion').map((d) => d.objetivo_id))]

  const [{ data: perfiles }, { data: clases }] = await Promise.all([
    idsUsuarios.length
      ? supabaseAdmin.from('perfiles').select('id, username').in('id', idsUsuarios)
      : { data: [] },
    idsSesiones.length
      ? supabaseAdmin.from('clases').select('id, titulo, ciudad, fecha').in('id', idsSesiones)
      : { data: [] },
  ])

  const usernames = new Map((perfiles || []).map((p) => [p.id, p.username]))
  const sesiones = new Map((clases || []).map((c) => [c.id, c]))

  return NextResponse.json({
    denuncias: denuncias.map((d) => ({
      ...d,
      denunciante_username: usernames.get(d.denunciante_id) || null,
      denunciado_username: usernames.get(d.usuario_denunciado_id) || null,
      sesion: d.tipo === 'sesion' ? sesiones.get(d.objetivo_id) || null : null,
    })),
  })
}

// Cambia el estado de una denuncia: { id, estado }.
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

  const { id, estado } = cuerpo || {}
  if (typeof id !== 'string' || !UUID.test(id) || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('denuncias').update({ estado }).eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
