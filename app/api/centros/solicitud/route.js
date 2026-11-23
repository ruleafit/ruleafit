import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { procesarSolicitud } from '../../../../lib/centros/procesarSolicitud'

// Endpoint público del formulario de /centros (N15). Guarda la solicitud con la clave de servicio (la tabla es
// privada) y avisa por correo con Resend. Ninguna clave llega al navegador.
export const runtime = 'nodejs'

const TAMANO_MAXIMO = 20000 // bytes: de sobra para un formulario de texto

export async function POST(request) {
  const longitud = Number(request.headers.get('content-length') || 0)
  if (longitud > TAMANO_MAXIMO) return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })

  let cuerpo = null
  try {
    cuerpo = await request.json()
  } catch {
    cuerpo = null
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const { estado, json } = await procesarSolicitud({
    cuerpo,
    origen: request.headers.get('origin'),
    host: request.headers.get('host'),
    admin: supabaseAdmin,
    // Destinatario administrativo ya configurado para los avisos de la plataforma; CENTROS_ADMIN_EMAIL permite
    // usar otro solo para centros si algún día se quiere.
    correoAdmin: process.env.CENTROS_ADMIN_EMAIL || process.env.FEEDBACK_ADMIN_EMAIL || '',
    enviarCorreo: async ({ para, respuestaA, asunto, texto }) => {
      if (!resend) return { error: new Error('Falta RESEND_API_KEY') }
      return resend.emails.send({ from: 'Ruleafit <no-reply@ruleafit.com>', to: para, replyTo: respuestaA, subject: asunto, text: texto })
    },
  })
  return NextResponse.json(json, { status: estado })
}
