import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { usuarioDePeticion, UUID } from '../../../../lib/verificaciones/sesion'

const TABLAS = { identidad: 'verificaciones_identidad', titulacion: 'titulaciones' }

// Aviso al administrador de una solicitud nueva, sin adjuntos ni datos del
// documento. Una sola vez por solicitud (avisado_en) y solo la del propio usuario.
export async function POST(request) {
  const sesion = await usuarioDePeticion(request)
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo, id } = (await request.json().catch(() => null)) || {}
  if (!Object.hasOwn(TABLAS, tipo) || typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  const { data: filas, error } = await supabaseAdmin
    .from(TABLAS[tipo])
    .update({ avisado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', sesion.usuario.id)
    .eq('estado', 'pendiente')
    .is('avisado_en', null)
    .select('id')
  if (error) return NextResponse.json({ error: 'No se pudo avisar' }, { status: 500 })
  if (!filas?.length) return NextResponse.json({ ok: true })

  const destino = (process.env.FEEDBACK_ADMIN_EMAIL || process.env.ADMIN_EMAILS || '').split(',')[0].trim()
  if (!destino || !process.env.RESEND_API_KEY) {
    console.error('Verificaciones: falta el correo administrativo o RESEND_API_KEY.')
    return NextResponse.json({ ok: true })
  }

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('username')
    .eq('id', sesion.usuario.id)
    .maybeSingle()

  const { error: errorEnvio } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Ruleafit <no-reply@ruleafit.com>',
    to: destino,
    subject: 'Nueva verificación pendiente en Ruleafit',
    text: [
      `Solicitud nueva: ${tipo === 'identidad' ? 'identidad' : 'titulación'}`,
      `Usuario: @${perfil?.username || sesion.usuario.id}`,
      '',
      'Revisar: https://www.ruleafit.com/admin/verificaciones',
    ].join('\n'),
  })
  if (errorEnvio) console.error('Verificaciones: error enviando el aviso.', errorEnvio)

  // La solicitud ya está guardada: un fallo del correo no se le muestra al usuario.
  return NextResponse.json({ ok: true })
}
