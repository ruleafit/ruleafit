import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { cronAutorizado } from '../../../../../lib/secretoCron'
import { formatearEuros } from '../../../../../lib/pagos/dinero.ts'

// Cierre automático del corte (sql/115_fichero_sepa_cron.sql, a diario). Solo actúa los días 1 y 16 de Madrid, cuando
// el corte anterior (fin de mes o 15) ya está completo. Solo CRON_SECRET. No envía dinero: avisa al administrador.
export async function POST(request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const dia = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', day: 'numeric' }).format(new Date())
  if (dia !== '1' && dia !== '16') return NextResponse.json({ ok: true, resultado: 'hoy_no_toca' })

  const { data, error } = await supabaseAdmin.rpc('cerrar_liquidacion')
  if (error && error.code !== 'P0001') {
    console.error('Cierre de liquidación:', error.code)
  }
  const sinImportes = error?.code === 'P0001'
  const para = process.env.ALERTAS_ADMIN_EMAIL || process.env.FEEDBACK_ADMIN_EMAIL
  let correo = false
  if (para && process.env.RESEND_API_KEY) {
    const texto = error
      ? sinImportes
        ? 'Hoy tocaba cerrar la liquidación y no hay ningún importe nuevo que pagar.'
        : 'Hoy tocaba cerrar la liquidación y ha fallado. Entra en /admin/liquidaciones y ciérrala a mano.'
      : `Liquidación cerrada: ${data.lineas} transferencias por ${formatearEuros(data.total_centimos)}. Entra en /admin/liquidaciones, descarga el fichero, fírmalo en el banco y márcalas como enviadas.`
    const { error: envio } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Ruleafit <no-reply@ruleafit.com>',
      to: para,
      subject: 'Liquidación a organizadores',
      text: texto,
    })
    correo = !envio
  }
  if (error && !sinImportes) return NextResponse.json({ error: 'No se ha podido cerrar', correo }, { status: 500 })
  return NextResponse.json({ ok: true, resultado: sinImportes ? 'sin_importes' : 'cerrada', lineas: data?.lineas || 0, correo })
}
