// Solo servidor. Aviso por correo al administrador de una solicitud pendiente,
// sin adjuntos ni datos del documento. Una sola vez por solicitud (avisado_en).
import { Resend } from 'resend'

export const TABLAS = {
  identidad: 'verificaciones_identidad',
  titulacion: 'titulaciones',
  centro: 'verificaciones_centro',
}
const NOMBRES = { identidad: 'identidad', titulacion: 'titulación', centro: 'centro' }

export async function avisarAdmin(admin, { tipo, id, usuarioId }) {
  const { data: filas, error } = await admin
    .from(TABLAS[tipo])
    .update({ avisado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .eq('estado', 'pendiente')
    .is('avisado_en', null)
    .select('id')
  if (error) throw new Error(error.message)
  if (!filas?.length) return

  const destino = (process.env.FEEDBACK_ADMIN_EMAIL || process.env.ADMIN_EMAILS || '').split(',')[0].trim()
  if (!destino || !process.env.RESEND_API_KEY) {
    console.error('Verificaciones: falta el correo administrativo o RESEND_API_KEY.')
    return
  }

  const { data: perfil } = await admin.from('perfiles').select('username').eq('id', usuarioId).maybeSingle()

  const { error: errorEnvio } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Ruleafit <no-reply@ruleafit.com>',
    to: destino,
    subject: 'Nueva verificación pendiente en Ruleafit',
    text: [
      `Solicitud pendiente: ${NOMBRES[tipo]}`,
      `Usuario: @${perfil?.username || usuarioId}`,
      '',
      'Revisar: https://www.ruleafit.com/admin/verificaciones',
    ].join('\n'),
  })
  if (errorEnvio) console.error('Verificaciones: error enviando el aviso.', errorEnvio)
}
