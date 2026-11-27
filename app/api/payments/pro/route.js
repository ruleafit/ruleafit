import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configRedsysDesdeEntorno, crearPeticionPago, nuevoPedido } from '../../../../lib/pagos/redsys.ts'
import { totalCoincide } from '../../../../lib/pagos/dinero.ts'

// Alta de la suscripción Pro (sql/107). El organizador envía su token de sesión y el importe que se le ha enseñado.
// El precio sale de la base de datos. La tarjeta se guarda en el banco para el cobro mensual: Ruleafit no la ve.
export async function POST(request) {
  if (process.env.PAGOS_ACTIVOS !== 'true') {
    return NextResponse.json({ error: 'Los pagos online no están activados todavía.' }, { status: 503 })
  }
  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }
  let totalCentimos
  try {
    ;({ totalCentimos } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }

  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    console.error('Redsys sin configurar:', e.message)
    return NextResponse.json({ error: 'El pago no está disponible ahora mismo.' }, { status: 503 })
  }

  // Cliente con la sesión de quien contrata: crear_pago_pro() usa auth.uid().
  const supabaseUsuario = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let pago = null
  let fallo = null
  for (let intento = 0; intento < 3 && !pago; intento++) {
    const { data, error } = await supabaseUsuario.rpc('crear_pago_pro', { p_pedido: nuevoPedido() })
    if (error && error.code === '23505') continue // pedido repetido
    if (error) {
      fallo = error
      break
    }
    pago = data
  }
  if (!pago) {
    const permitido = fallo && ['P0001', 'P0002', '42501', '28000'].includes(fallo.code)
    if (!permitido) console.error('crear_pago_pro falló:', fallo?.code)
    return NextResponse.json(
      { error: permitido ? fallo.message : 'No se ha podido iniciar el pago.' },
      { status: permitido ? 400 : 500 }
    )
  }
  if (!totalCoincide(totalCentimos, pago.importe_centimos)) {
    return NextResponse.json({ error: 'El precio ha cambiado. Recarga la página antes de pagar.' }, { status: 409 })
  }

  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ruleafit.com').replace(/\/$/, '')
  return NextResponse.json(
    crearPeticionPago(cfg, {
      pedido: pago.pedido,
      importeCentimos: pago.importe_centimos,
      urlNotificacion: `${sitio}/api/payments/redsys-webhook`,
      urlOk: `${sitio}/pro?pago=ok`,
      urlKo: `${sitio}/pro?pago=ko`,
      metodo: 'tarjeta',
      guardarTarjeta: true,
    })
  )
}
