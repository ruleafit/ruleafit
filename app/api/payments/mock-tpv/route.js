import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { configRedsysDesdeEntorno } from '../../../../lib/pagos/redsys.ts'
import {
  RUTA_MOCK,
  bancoSimuladoDevolucion,
  bancoSimuladoRecurrente,
  ejecutarEscenario,
  esEscenario,
  leerPeticionDeCobro,
  permisoMockTpv,
} from '../../../../lib/pagos/mockTpv.ts'
import { pagina } from '../../../../lib/pagos/mockTpvPagina.ts'
import { procesarDevoluciones } from '../../../../lib/pagos/procesarDevoluciones.ts'
import { procesarRenovaciones } from '../../../../lib/pagos/procesarRenovaciones.ts'
import { POST as webhookRedsys } from '../redsys-webhook/route'

// SIMULADOR DEL TPV (Pendiente 33). Responde 404 salvo en local o Vercel Preview, con activación expresa y contra
// una base de datos que NO sea la de producción (lib/pagos/mockTpv.ts). No habla con ningún banco.
// El aviso se entrega al manejador REAL de /api/payments/redsys-webhook dentro del mismo proceso (así funciona
// también en un Preview protegido, donde una llamada HTTP a sí mismo se rechazaría).

export const dynamic = 'force-dynamic'

function noExiste() {
  const permiso = permisoMockTpv({
    ...process.env,
    // Acceso literal: es el mismo valor que usa el cliente de Supabase en esta compilación.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
  if (permiso.permitido) return null
  if (process.env.VERCEL_ENV !== 'production') console.warn('TPV simulado desactivado:', permiso.motivo)
  return new Response('Not Found', { status: 404 })
}

const html = (cuerpo, status = 200) =>
  new Response(cuerpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })

async function enviarAlWebhook(origen, aviso) {
  const respuesta = await webhookRedsys(
    new Request(new URL('/api/payments/redsys-webhook', origen), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(aviso),
    })
  )
  const cuerpo = await respuesta.json().catch(() => ({}))
  return { status: respuesta.status, resultado: cuerpo.resultado || cuerpo.error || 'sin respuesta' }
}

async function leerCobro(pedido) {
  const { data: cobro } = await supabaseAdmin
    .from('cobros')
    .select('pedido_redsys, importe_centimos, estado, clase_id, cliente_id')
    .eq('pedido_redsys', pedido)
    .maybeSingle()
  if (!cobro) {
    const { data: pro } = await supabaseAdmin
      .from('pagos_pro')
      .select('pedido_redsys, importe_centimos, estado')
      .eq('pedido_redsys', pedido)
      .maybeSingle()
    return pro
      ? { fila: pro, resumen: { pedido: pro.pedido_redsys, importeCentimos: pro.importe_centimos, estado: pro.estado } }
      : null
  }
  const { data: clase } = cobro.clase_id
    ? await supabaseAdmin.from('clases').select('plazas_ocupadas, plazas_max').eq('id', cobro.clase_id).maybeSingle()
    : { data: null }
  return {
    fila: cobro,
    resumen: { pedido: cobro.pedido_redsys, importeCentimos: cobro.importe_centimos, estado: cobro.estado },
    plazas: clase ? { ocupadas: clase.plazas_ocupadas, maximas: clase.plazas_max } : undefined,
  }
}

export async function GET() {
  return noExiste() || html(pagina({}))
}

export async function POST(request) {
  const cerrado = noExiste()
  if (cerrado) return cerrado

  let cfg
  try {
    cfg = configRedsysDesdeEntorno()
  } catch (e) {
    return html(pagina({ aviso: e.message }), 503)
  }

  let datos
  try {
    datos = await request.formData()
  } catch {
    return html(pagina({ aviso: 'Petición no válida.' }), 400)
  }
  const texto = (n) => (typeof datos.get(n) === 'string' ? datos.get(n) : undefined)
  const accion = texto('accion')

  if (accion === 'devolver') {
    const { cuerpo, status } = await procesarDevoluciones(supabaseAdmin, cfg, bancoSimuladoDevolucion(cfg))
    const aviso = cuerpo.parado
      ? 'Las devoluciones están en pausa (parada segura). Revisa /admin/alertas.'
      : cuerpo.error ||
        `Devoluciones completadas: ${cuerpo.completadas} · rechazadas: ${cuerpo.rechazadas} · dudosas: ${cuerpo.dudosas}`
    return html(pagina({ aviso }), status)
  }

  // Atajos de prueba. Solo se llega aquí contra una base de datos de pruebas (permisoMockTpv).
  if (accion === 'renovar' || accion === 'renovar_denegada') {
    const { cuerpo, status } = await procesarRenovaciones(supabaseAdmin, cfg, bancoSimuladoRecurrente(cfg, accion === 'renovar'))
    const aviso = cuerpo.parado
      ? 'Los cobros están en pausa o apagados.'
      : cuerpo.error ||
        `Renovaciones cobradas: ${cuerpo.cobradas} · denegadas: ${cuerpo.denegadas} · dudosas: ${cuerpo.dudosas}`
    return html(pagina({ aviso }), status)
  }
  if (accion === 'adelantar') {
    const ahora = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('suscripciones_pro')
      .update({ periodo_fin: ahora, ultimo_intento_en: null })
      .neq('estado', 'caducada')
      .select('usuario_id')
    return html(pagina({ aviso: error ? 'No se ha podido adelantar.' : `Suscripciones adelantadas: ${data.length}` }), error ? 500 : 200)
  }
  if (accion === 'liberar') {
    const hace49h = new Date(Date.now() - 49 * 3600 * 1000).toISOString()
    const { error } = await supabaseAdmin
      .from('cobros')
      .update({ pagado_en: hace49h })
      .eq('tipo', 'bono')
      .in('estado', ['pagado', 'reembolsado_parcial'])
      .is('liberado_en', null)
      .gt('pagado_en', hace49h)
    const { data: liberados, error: errorLiberar } = await supabaseAdmin.rpc('liberar_pendientes')
    const fallo = error || errorLiberar
    return html(pagina({ aviso: fallo ? 'No se ha podido liberar.' : `Cobros liberados: ${liberados}` }), fallo ? 500 : 200)
  }

  const campos = {
    Ds_SignatureVersion: texto('Ds_SignatureVersion') || 'HMAC_SHA256_V1',
    Ds_MerchantParameters: texto('Ds_MerchantParameters'),
    Ds_Signature: texto('Ds_Signature'),
  }
  const peticion = leerPeticionDeCobro(cfg, campos)
  if (!peticion) return html(pagina({ aviso: 'La petición de pago no tiene una firma válida.' }), 400)

  let cobro = await leerCobro(peticion.pedido)
  if (!cobro) return html(pagina({ aviso: 'No existe ningún cobro con ese pedido.' }), 404)

  // Primera llegada desde la web (sin acción): se enseñan los botones.
  if (!accion) return html(pagina({ campos, cobro: cobro.resumen, plazas: cobro.plazas }))
  if (!esEscenario(accion)) return html(pagina({ campos, cobro: cobro.resumen, aviso: 'Acción no válida.' }), 400)

  const { data: otros } = cobro.fila.clase_id
    ? await supabaseAdmin
        .from('cobros')
        .select('pedido_redsys, importe_centimos')
        .eq('clase_id', cobro.fila.clase_id)
        .eq('estado', 'creado')
        .neq('cliente_id', cobro.fila.cliente_id)
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: [] }

  const origen = new URL(RUTA_MOCK, request.url)
  const { envios, aviso } = await ejecutarEscenario(accion, {
    cfg,
    cobro: peticion,
    rivales: (otros || []).map((c) => ({ pedido: c.pedido_redsys, importeCentimos: c.importe_centimos })),
    plazasLibres: cobro.plazas ? cobro.plazas.maximas - cobro.plazas.ocupadas : 0,
    enviar: (a) => enviarAlWebhook(origen, a),
  })

  cobro = (await leerCobro(peticion.pedido)) || cobro
  return html(pagina({ campos, cobro: cobro.resumen, plazas: cobro.plazas, envios, aviso }))
}
