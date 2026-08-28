import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  // 1. Verificar el secreto: solo el trigger de Supabase (via pg_net) puede llamar aqui.
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Leer el feedbackId del body.
  const { feedbackId } = await request.json()
  if (!feedbackId) {
    return NextResponse.json({ error: 'Falta feedbackId' }, { status: 400 })
  }

  // 3. Leer el feedback de la base de datos.
  const { data: feedback, error: errorFeedback } = await supabaseAdmin
    .from('feedback')
    .select('mensaje, user_id, created_at')
    .eq('id', feedbackId)
    .single()

  if (errorFeedback || !feedback) {
    return NextResponse.json({ error: 'Feedback no encontrado' }, { status: 404 })
  }

  // 4. Intentar obtener el email del usuario (no bloqueante si falla).
  let emailUsuario = null
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(feedback.user_id)
    emailUsuario = userData?.user?.email || null
  } catch {
    emailUsuario = null
  }

  // 5. Enviar el correo con Resend.
  const remitente = emailUsuario || feedback.user_id
  const fecha = new Date(feedback.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

  const { error: errorEnvio } = await resend.emails.send({
    from: 'Ruleafit <no-reply@ruleafit.com>',
    to: process.env.FEEDBACK_ADMIN_EMAIL,
    subject: 'Nuevo feedback de usuario en Ruleafit',
    text: `De: ${remitente}\nFecha: ${fecha}\n\n${feedback.mensaje}`,
  })

  if (errorEnvio) {
    console.error('Error enviando aviso de feedback:', errorEnvio)
    return NextResponse.json({ error: 'Error enviando el correo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
