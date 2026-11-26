import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../lib/secretoCron'
import { correoDeAlertas } from '../../../lib/pagos/alertas.ts'

// Vigilancia periódica (cron, CRON_SECRET): revisa la salud de pagos y procesos (sql/099) y envía UN correo con
// las alertas nuevas. Las alertas solo se marcan como avisadas si el correo sale; si no, se reintenta.
export async function POST(request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: salud, error: errorSalud } = await supabaseAdmin.rpc('revisar_salud_pagos')
  if (errorSalud) console.error('revisar_salud_pagos falló:', errorSalud.code)

  const { data: alertas, error } = await supabaseAdmin.rpc('alertas_por_avisar')
  if (error) {
    console.error('alertas_por_avisar falló:', error.code)
    return NextResponse.json({ error: 'Error leyendo las alertas' }, { status: 500 })
  }
  if (!alertas?.length) {
    return NextResponse.json({ ok: !errorSalud, avisadas: 0 })
  }

  const destino = process.env.ALERTAS_ADMIN_EMAIL || process.env.FEEDBACK_ADMIN_EMAIL
  if (!destino || !process.env.RESEND_API_KEY) {
    console.error('Alertas sin destinatario o sin Resend configurado')
    return NextResponse.json({ error: 'Correo no configurado' }, { status: 503 })
  }

  const paradas = salud?.paradas ?? (await supabaseAdmin.rpc('estado_paradas')).data
  const { subject, text } = correoDeAlertas(alertas, paradas)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: errorEnvio } = await resend.emails.send({
    from: 'Ruleafit <no-reply@ruleafit.com>',
    to: destino,
    subject,
    text,
  })
  if (errorEnvio) {
    console.error('Error enviando las alertas:', errorEnvio.name)
    return NextResponse.json({ error: 'Error enviando el correo' }, { status: 500 })
  }

  await supabaseAdmin.rpc('marcar_alertas_avisadas', { p_ids: alertas.map((a) => a.id) })
  return NextResponse.json({ ok: !errorSalud, avisadas: alertas.length })
}
