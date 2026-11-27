import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configRedsysDesdeEntorno, crearPeticionPago, nuevoPedido } from '../../../../lib/pagos/redsys.ts'
import { calcularDesglose, totalCoincide } from '../../../../lib/pagos/dinero.ts'

const PRECIO_CAMBIADO = 'El precio no coincide con el que se te ha mostrado. Recarga la página y revisa el desglose antes de pagar.'

// Inicia el pago de una sesión (claseId) o de un bono (bonoId, sql/107). El alumno envía su token de sesión de Supabase
// (Authorization: Bearer ...). El importe NUNCA viene del
// navegador: lo calcula la base de datos desde el precio de la sesión. El navegador
// envía además el total que ha ENSEÑADO (totalCentimos), solo para comprobarlo: si no
// coincide con el del servidor no se redirige al banco.
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

  let claseId, bonoId, metodo, totalCentimos
  try {
    ;({ claseId, bonoId, metodo, totalCentimos } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }
  const esBono = bonoId !== undefined
  const id = esBono ? bonoId : claseId
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || (esBono && claseId !== undefined)) {
    return NextResponse.json({ error: esBono ? 'Bono no válido' : 'Sesión no válida' }, { status: 400 })
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

  // Antes de crear el cobro: el total visto debe ser el que sale del precio actual (misma función que el navegador).
  const { data: sesionActual, error: errorSesion } = await supabaseUsuario
    .from(esBono ? 'bonos' : 'clases')
    .select('precio')
    .eq('id', id)
    .maybeSingle()
  if (errorSesion) {
    return NextResponse.json({ error: 'No se ha podido iniciar el pago.' }, { status: 500 })
  }
  const desglose = calcularDesglose(sesionActual?.precio)
  if (!desglose || !totalCoincide(totalCentimos, desglose.totalCentimos)) {
    return NextResponse.json({ error: PRECIO_CAMBIADO }, { status: 409 })
  }

  // El pedido es aleatorio; si choca con otro (casi imposible) se reintenta.
  let cobro = null
  let errorCobro = null
  for (let intento = 0; intento < 3 && !cobro; intento++) {
    const pedido = nuevoPedido()
    const { data, error } = await supabaseUsuario.rpc(esBono ? 'crear_cobro_bono' : 'crear_cobro', {
      ...(esBono ? { p_bono_id: id } : { p_clase_id: id }),
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

  // Y el importe que ha calculado la base de datos también (el precio pudo cambiar entre medias). El cobro queda
  // en 'creado' sin enviarse al banco, así que nunca se llega a pagar.
  if (!totalCoincide(totalCentimos, cobro.importe_centimos)) {
    return NextResponse.json({ error: PRECIO_CAMBIADO }, { status: 409 })
  }

  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ruleafit.com').replace(/\/$/, '')
  const formulario = crearPeticionPago(cfg, {
    pedido: cobro.pedido,
    importeCentimos: cobro.importe_centimos,
    urlNotificacion: `${sitio}/api/payments/redsys-webhook`,
    urlOk: esBono ? `${sitio}/mis-reservas?pestana=bonos&pago=ok` : `${sitio}/pagos/ok`,
    urlKo: `${sitio}/pagos/ko`,
    metodo: metodoPago,
  })

  return NextResponse.json(formulario)
}
