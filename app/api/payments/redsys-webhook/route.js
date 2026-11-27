import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { configRedsysDesdeEntorno, verificarNotificacion } from '../../../../lib/pagos/redsys.ts'
import { ALERTAS } from '../../../../lib/pagos/alertas.ts'
import { registrarAlerta } from '../../../../lib/pagos/registrarAlerta.ts'

// Aviso del banco (Redsys) al terminar un pago. Es la ÚNICA fuente de verdad de
// que un pago se ha hecho: el regreso del alumno a /pagos/ok no confirma nada.
// 1) Se verifica la firma con la clave secreta; si no es válida, se ignora.
// 2) Se llama a confirmar_cobro_pagado (idempotente y comprobando el importe).
export async function POST(request) {
  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    console.error('Webhook Redsys sin configurar:', e.message)
    await registrarAlerta(supabaseAdmin, ALERTAS.webhookSinConfigurar())
    return NextResponse.json({ error: 'No configurado' }, { status: 503 })
  }

  let entrada = {}
  try {
    const tipo = request.headers.get('content-type') || ''
    if (tipo.includes('application/json')) {
      entrada = await request.json()
    } else {
      const datos = await request.formData()
      entrada = {
        Ds_MerchantParameters: datos.get('Ds_MerchantParameters'),
        Ds_Signature: datos.get('Ds_Signature'),
      }
    }
  } catch {
    return NextResponse.json({ error: 'Cuerpo no válido' }, { status: 400 })
  }

  const n = verificarNotificacion(cfg.claveSecreta, {
    Ds_MerchantParameters: typeof entrada.Ds_MerchantParameters === 'string' ? entrada.Ds_MerchantParameters : undefined,
    Ds_Signature: typeof entrada.Ds_Signature === 'string' ? entrada.Ds_Signature : undefined,
  })
  if (!n.valida) {
    console.warn('Webhook Redsys con firma no válida')
    await registrarAlerta(supabaseAdmin, ALERTAS.webhookFirmaNoValida())
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 })
  }

  let { data, error } = await supabaseAdmin.rpc('confirmar_cobro_pagado', {
    p_pedido: n.pedido,
    p_importe_centimos: n.importeCentimos,
    p_autorizado: n.autorizado,
    p_codigo_respuesta: n.codigoRespuesta,
    p_codigo_autorizacion: n.codigoAutorizacion,
  })
  // Si no es el cobro de un alumno, puede ser el de la suscripción Pro (sql/107).
  if (!error && data?.resultado === 'desconocido') {
    const pro = await supabaseAdmin.rpc('confirmar_pago_pro', {
      p_pedido: n.pedido,
      p_importe_centimos: n.importeCentimos,
      p_autorizado: n.autorizado,
      p_codigo_respuesta: n.codigoRespuesta,
      p_identificador: n.identificadorTarjeta,
      p_cof_txnid: n.cofTxnid,
    })
    // Sin sql/107 la función no existe: el pedido sigue siendo desconocido.
    if (pro.error?.code !== 'PGRST202') ({ data, error } = pro)
  }
  if (error) {
    console.error('confirmar_cobro_pagado falló:', error.code)
    await registrarAlerta(supabaseAdmin, ALERTAS.webhookErrorConfirmando(error.code))
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
  }

  if (data?.resultado === 'importe_no_coincide' || data?.resultado === 'desconocido') {
    console.error('Webhook Redsys con resultado anómalo:', data.resultado, n.pedido)
    await registrarAlerta(supabaseAdmin, ALERTAS.webhookAnomalo(data.resultado, n.pedido))
  }
  return NextResponse.json({ ok: true, resultado: data?.resultado })
}
