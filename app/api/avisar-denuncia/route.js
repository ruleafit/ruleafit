import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const resend = new Resend(process.env.RESEND_API_KEY)

const MOTIVOS = {
  contenido_inapropiado: 'Contenido inapropiado u ofensivo',
  estafa: 'Estafa o engaño',
  suplantacion: 'Suplantación de identidad',
  acoso: 'Acoso o comportamiento abusivo',
  peligro: 'Peligro para la seguridad',
  otro: 'Otro motivo',
}

// Aviso por correo al administrador cuando se crea una denuncia. Lo llama el
// trigger de la tabla denuncias (sql/070) por pg_net, con el mismo secreto que
// el aviso de feedback (CRON_SECRET como Bearer).
export async function POST(request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let denunciaId
  try {
    ;({ denunciaId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }
  if (!denunciaId) {
    return NextResponse.json({ error: 'Falta denunciaId' }, { status: 400 })
  }

  const { data: d, error } = await supabaseAdmin
    .from('denuncias')
    .select('tipo, objetivo_id, usuario_denunciado_id, denunciante_id, motivo, comentario, created_at')
    .eq('id', denunciaId)
    .single()

  if (error || !d) {
    return NextResponse.json({ error: 'Denuncia no encontrada' }, { status: 404 })
  }

  const idsUsuarios = [d.denunciante_id, d.usuario_denunciado_id].filter(Boolean)
  const { data: perfiles } = idsUsuarios.length
    ? await supabaseAdmin.from('perfiles').select('id, username').in('id', idsUsuarios)
    : { data: [] }
  const nombre = (id) => (perfiles || []).find((p) => p.id === id)?.username

  let objetivo = `usuario @${nombre(d.usuario_denunciado_id) || d.objetivo_id}`
  if (d.tipo === 'sesion') {
    const { data: clase } = await supabaseAdmin.from('clases').select('titulo, ciudad').eq('id', d.objetivo_id).maybeSingle()
    objetivo = `sesión "${clase?.titulo || d.objetivo_id}"${clase?.ciudad ? ` (${clase.ciudad})` : ''}`
  }

  const fecha = new Date(d.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
  const texto = [
    `Nueva denuncia en Ruleafit`,
    ``,
    `Contra: ${objetivo}`,
    `Motivo: ${MOTIVOS[d.motivo] || d.motivo}`,
    `Denunciante: ${nombre(d.denunciante_id) ? '@' + nombre(d.denunciante_id) : 'cuenta eliminada'}`,
    `Fecha: ${fecha}`,
    d.comentario ? `\nComentario:\n${d.comentario}` : '',
    `\nRevisar: https://www.ruleafit.com/admin/denuncias`,
  ].join('\n')

  const { error: errorEnvio } = await resend.emails.send({
    from: 'Ruleafit <no-reply@ruleafit.com>',
    to: process.env.FEEDBACK_ADMIN_EMAIL,
    subject: 'Nueva denuncia en Ruleafit',
    text: texto,
  })

  if (errorEnvio) {
    console.error('Error enviando aviso de denuncia:', errorEnvio)
    return NextResponse.json({ error: 'Error enviando el correo' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
