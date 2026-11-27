// SIMULADOR DEL TPV DE REDSYS (Pendiente 33), solo para local y Vercel Preview con una base de datos DE PRUEBAS.
// Aquí va la lógica sin Next ni Supabase: cuándo se permite, firmas y escenarios.
// Los avisos se firman con la misma función que verifica el webhook real (redsys.ts).
import { timingSafeEqual } from 'node:crypto'
import { esPedidoValido, firmarParametros, type ConfigRedsys } from './redsys.ts'

export const RUTA_MOCK = '/api/payments/mock-tpv'
/** Proyecto Supabase de PRODUCCIÓN (su referencia es pública: va en la web). El simulador jamás escribe en él. */
export const REF_SUPABASE_PRODUCCION = 'fjedrczlbyxevjuqqhra'

export type Permiso = { permitido: true } | { permitido: false; motivo: string }

function refDeSupabase(url: string | undefined): string | null {
  try {
    const { hostname, protocol } = new URL(url || '')
    if (hostname === '127.0.0.1' || hostname === 'localhost') return 'local'
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(hostname)
    return m && protocol === 'https:' ? m[1] : null
  } catch {
    return null
  }
}

/** Todas las condiciones a la vez; ante cualquier duda, no. */
export function permisoMockTpv(env: Record<string, string | undefined>): Permiso {
  const no = (motivo: string): Permiso => ({ permitido: false, motivo })
  if (env.VERCEL_ENV === 'production') return no('producción')
  const preview = env.VERCEL_ENV === 'preview'
  const local =
    env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && !env.VERCEL && env.NODE_ENV === 'development')
  if (!preview && !local) return no('solo en local o en Vercel Preview')
  if (env.MOCK_TPV_ACTIVO !== 'true') return no('falta MOCK_TPV_ACTIVO=true')
  // Con REDSYS_URL apuntando al simulador, nunca convive con una configuración del banco.
  if (env.REDSYS_URL !== RUTA_MOCK) return no(`REDSYS_URL debe ser ${RUTA_MOCK}`)
  const ref = refDeSupabase(env.NEXT_PUBLIC_SUPABASE_URL)
  if (!ref) return no('no se reconoce el proyecto de Supabase')
  if (ref === REF_SUPABASE_PRODUCCION) return no('la base de datos es la de PRODUCCIÓN')
  if (env.MOCK_TPV_SUPABASE_REF !== ref) return no('MOCK_TPV_SUPABASE_REF no coincide con la base de datos')
  return { permitido: true }
}

export type CamposFirmados = { Ds_SignatureVersion: string; Ds_MerchantParameters: string; Ds_Signature: string }

const aBase64Url = (v: string) => v.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const iguales = (a: string, b: string) => {
  const x = Buffer.from(aBase64Url(a))
  const y = Buffer.from(aBase64Url(b))
  return x.length === y.length && timingSafeEqual(x, y)
}
const leerParametros = (base64: string): Record<string, string> | null => {
  try {
    const p = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
    return p && typeof p === 'object' ? p : null
  } catch {
    return null
  }
}

/** La petición de COBRO que la web envía al «banco»: solo se acepta con la firma correcta. */
export function leerPeticionDeCobro(
  cfg: ConfigRedsys,
  entrada: { Ds_MerchantParameters?: string; Ds_Signature?: string }
): CobroSimulado | null {
  const { Ds_MerchantParameters: parametros, Ds_Signature: firma } = entrada
  if (!parametros || !firma) return null
  const p = leerParametros(parametros)
  const pedido = String(p?.DS_MERCHANT_ORDER ?? '')
  const importe = String(p?.DS_MERCHANT_AMOUNT ?? '')
  if (!p || p.DS_MERCHANT_TRANSACTIONTYPE !== '0' || !esPedidoValido(pedido) || !/^\d+$/.test(importe)) return null
  if (!iguales(firmarParametros(cfg.claveSecreta, pedido, parametros), firma)) return null
  return {
    pedido,
    importeCentimos: Number(importe),
    ...(p.DS_MERCHANT_IDENTIFIER === 'REQUIRED' ? { guardarTarjeta: true } : {}),
  }
}

/** Aviso firmado como lo enviaría el banco (firma en base64 apta para URL). */
export function crearAvisoDelBanco(
  cfg: ConfigRedsys,
  datos: { pedido: string; importeCentimos: number; codigo: string; guardarTarjeta?: boolean }
): CamposFirmados {
  const parametros = {
    Ds_Order: datos.pedido,
    Ds_Amount: String(datos.importeCentimos),
    Ds_Response: datos.codigo,
    Ds_AuthorisationCode: Number(datos.codigo) <= 99 ? '000SIM' : '',
    Ds_MerchantCode: cfg.codigoComercio,
    Ds_Terminal: cfg.terminal,
    Ds_Currency: '978',
    // Como el banco al guardar la tarjeta de una suscripción (referencias inventadas).
    ...(datos.guardarTarjeta && Number(datos.codigo) <= 99
      ? { Ds_Merchant_Identifier: `SIM-${datos.pedido}`, Ds_Merchant_Cof_Txnid: `TXN-${datos.pedido}` }
      : {}),
  }
  const base64 = Buffer.from(JSON.stringify(parametros), 'utf8').toString('base64')
  return {
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: base64,
    Ds_Signature: aBase64Url(firmarParametros(cfg.claveSecreta, datos.pedido, base64)),
  }
}

/** Banco simulado para devoluciones: comprueba la petición firmada y responde 0900 (aceptada), también firmado. */
export function bancoSimuladoDevolucion(cfg: ConfigRedsys): typeof fetch {
  return (async (_url: unknown, opciones?: { body?: unknown }) => {
    const campos = JSON.parse(String(opciones?.body ?? '{}'))
    const p = leerParametros(String(campos.Ds_MerchantParameters ?? ''))
    const pedido = String(p?.DS_MERCHANT_ORDER ?? '')
    const valida =
      !!p &&
      p.DS_MERCHANT_TRANSACTIONTYPE === '3' &&
      esPedidoValido(pedido) &&
      iguales(firmarParametros(cfg.claveSecreta, pedido, campos.Ds_MerchantParameters), String(campos.Ds_Signature ?? ''))
    const cuerpo = valida
      ? crearAvisoDelBanco(cfg, { pedido, importeCentimos: Number(p.DS_MERCHANT_AMOUNT), codigo: '0900' })
      : { errorCode: 'SIS0042' }
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

/** Banco simulado para el cobro mensual: comprueba la petición firmada y la aprueba o la deniega. */
export function bancoSimuladoRecurrente(cfg: ConfigRedsys, aprobar: boolean): typeof fetch {
  return (async (_url: unknown, opciones?: { body?: unknown }) => {
    const campos = JSON.parse(String(opciones?.body ?? '{}'))
    const p = leerParametros(String(campos.Ds_MerchantParameters ?? ''))
    const pedido = String(p?.DS_MERCHANT_ORDER ?? '')
    const valida =
      !!p &&
      p.DS_MERCHANT_COF_INI === 'N' &&
      !!p.DS_MERCHANT_IDENTIFIER &&
      esPedidoValido(pedido) &&
      iguales(firmarParametros(cfg.claveSecreta, pedido, campos.Ds_MerchantParameters), String(campos.Ds_Signature ?? ''))
    const cuerpo = valida
      ? crearAvisoDelBanco(cfg, { pedido, importeCentimos: Number(p.DS_MERCHANT_AMOUNT), codigo: aprobar ? '0000' : '0190' })
      : { errorCode: 'SIS0042' }
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

export const ESCENARIOS = {
  autorizar: 'Pago autorizado (0000)',
  rechazar: 'Pago rechazado (0190)',
  doble: 'Aviso del banco repetido (idempotencia)',
  ultima_plaza: 'Dos pagan la última plaza a la vez',
} as const
export type Escenario = keyof typeof ESCENARIOS

export const esEscenario = (v: unknown): v is Escenario => typeof v === 'string' && Object.hasOwn(ESCENARIOS, v)

export type CobroSimulado = { pedido: string; importeCentimos: number; guardarTarjeta?: boolean }
export type RespuestaWebhook = { status: number; resultado: string }
export type Envio = RespuestaWebhook & { pedido: string; codigo: string }

/** Ejecuta un escenario enviando avisos al webhook (`enviar`). Devuelve lo que ha respondido a cada uno. */
export async function ejecutarEscenario(
  escenario: Escenario,
  datos: {
    cfg: ConfigRedsys
    cobro: CobroSimulado
    /** Otros cobros sin pagar de la misma sesión (de otras personas). */
    rivales: CobroSimulado[]
    plazasLibres: number
    enviar: (aviso: CamposFirmados) => Promise<RespuestaWebhook>
  }
): Promise<{ envios: Envio[]; aviso?: string }> {
  const { cfg, cobro, rivales, plazasLibres, enviar } = datos
  const lanzar = async (c: CobroSimulado, codigo: string, aviso = crearAvisoDelBanco(cfg, { ...c, codigo })) => ({
    pedido: c.pedido,
    codigo,
    ...(await enviar(aviso)),
  })

  if (escenario === 'autorizar') return { envios: [await lanzar(cobro, '0000')] }
  if (escenario === 'rechazar') return { envios: [await lanzar(cobro, '0190')] }
  if (escenario === 'doble') {
    const aviso = crearAvisoDelBanco(cfg, { ...cobro, codigo: '0000' })
    const primero = await lanzar(cobro, '0000', aviso)
    return { envios: [primero, await lanzar(cobro, '0000', aviso)] }
  }
  if (plazasLibres !== 1) {
    return { envios: [], aviso: `Para esta prueba la sesión debe tener exactamente 1 plaza libre (ahora: ${plazasLibres}).` }
  }
  if (rivales.length === 0) {
    return { envios: [], aviso: 'Falta el segundo pago: otra persona tiene que abrir el pago de esta misma sesión y quedarse en esta pantalla.' }
  }
  return { envios: await Promise.all([cobro, rivales[0]].map((c) => lanzar(c, '0000'))) }
}
