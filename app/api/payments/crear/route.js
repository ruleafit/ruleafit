import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configRedsysDesdeEntorno, crearPeticionPago, nuevoPedido } from '../../../../lib/pagos/redsys.ts'

// Inicia el pago de una sesión. El alumno envía su token de sesión de Supabase
// (Authorization: Bearer ...) y el id de la sesión. El importe NUNCA viene del
// navegador: lo calcula la base de datos desde el precio de la sesión.
// Devuelve el formulario firmado al que el navegador redirige al banco.
// Mientras PAGOS_ACTIVOS no sea "true" responde 503 y no hace nada.
export async function POST(request) {
  if (process.env.PAGOS_ACTIVOS !== 'true') {
    return NextResponse.json({ error: 'Los pagos online no están activados todavía.' }, { status: 503 })
  }

  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Debes iniciar sesión para pagar.' }, { status: 401 })
  }

  let claseId, metodo
  try {
    ;({ claseId, metodo } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }
  if (typeof claseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(claseId)) {
    return NextResponse.json({ error: 'Sesión no válida' }, { status: 400 })
  }
  const metodoPago = metodo === 'bizum' ? 'bizum' : 'tarjeta'

  // Cliente con la sesión del alumno: crear_cobro() usa auth.uid().
  const supabaseUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    console.error('Redsys sin configurar:', e.message)
    return NextResponse.json({ error: 'El pago no está disponible ahora mismo.' }, { status: 503 })
  }

  // El pedido es aleatorio; si choca con otro (casi imposible) se reintenta.
  let cobro = null
  let errorCobro = null
  for (let intento = 0; intento < 3 && !cobro; intento++) {
    const pedido = nuevoPedido()
    const { data, error } = await supabaseUsuario.rpc('crear_cobro', {
      p_clase_id: claseId,
      p_pedido: pedido,
      p_metodo: metodoPago,
    })
    if (error && error.code === '23505') continue // pedido repetido
    if (error) {
      errorCobro = error
      break
    }
    cobro = data
  }

  if (!cobro) {
    // Los mensajes de las excepciones de la base de datos están pensados para el usuario.
    const permitido = errorCobro && ['P0001', 'P0002', '42501', '28000'].includes(errorCobro.code)
    if (!permitido) console.error('crear_cobro falló:', errorCobro?.code)
    return NextResponse.json(
      { error: permitido ? errorCobro.message : 'No se ha podido iniciar el pago.' },
      { status: permitido ? 400 : 500 }
    )
  }

  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ruleafit.com').replace(/\/$/, '')
  const formulario = crearPeticionPago(cfg, {
    pedido: cobro.pedido,
    importeCentimos: cobro.importe_centimos,
    urlNotificacion: `${sitio}/api/payments/redsys-webhook`,
    urlOk: `${sitio}/pagos/ok`,
    urlKo: `${sitio}/pagos/ko`,
    metodo: metodoPago,
  })

  return NextResponse.json(formulario)
}
