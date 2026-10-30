import { createCipheriv, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

// Cobro con tarjeta o Bizum en el TPV virtual de CaixaBank (plataforma Redsys,
// firma HMAC_SHA256_V1). Solo servidor: usa la clave secreta del comercio.
// Ruleafit nunca ve datos de tarjeta: el alumno los escribe en la página del banco.

export type ConfigRedsys = {
  /** Código de comercio (FUC), variable REDSYS_MERCHANT_CODE. */
  codigoComercio: string
  /** Número de terminal, normalmente "1" (REDSYS_TERMINAL). */
  terminal: string
  /** Clave secreta del comercio en base64 (REDSYS_SECRET_KEY). */
  claveSecreta: string
  /** Dirección de la pasarela: pruebas o producción (REDSYS_URL). */
  urlPasarela: string
}

export type PeticionPago = {
  /** Pedido de 4 a 12 caracteres: las 4 primeras cifras, el resto letras o cifras. */
  pedido: string
  /** Importe en céntimos enteros. */
  importeCentimos: number
  /** Dirección que el banco llama (webhook) al terminar el pago. */
  urlNotificacion: string
  urlOk: string
  urlKo: string
  /** "tarjeta" (por defecto) o "bizum". */
  metodo?: 'tarjeta' | 'bizum'
}

export type FormularioRedsys = {
  url: string
  campos: {
    Ds_SignatureVersion: 'HMAC_SHA256_V1'
    Ds_MerchantParameters: string
    Ds_Signature: string
  }
}

export const CONCEPTO_COMERCIAL = 'RULEAFIT'
const MONEDA_EURO = '978'
const TRANSACCION_AUTORIZACION = '0'
const IDIOMA_ESPANOL = '001'

/** Configuración tomada de las variables de entorno; falla si falta alguna. */
export function configRedsysDesdeEntorno(env: NodeJS.ProcessEnv = process.env): ConfigRedsys {
  const cfg = {
    codigoComercio: env.REDSYS_MERCHANT_CODE,
    terminal: env.REDSYS_TERMINAL || '1',
    claveSecreta: env.REDSYS_SECRET_KEY,
    urlPasarela: env.REDSYS_URL,
  }
  const faltan = Object.entries({
    REDSYS_MERCHANT_CODE: cfg.codigoComercio,
    REDSYS_SECRET_KEY: cfg.claveSecreta,
    REDSYS_URL: cfg.urlPasarela,
  })
    .filter(([, valor]) => !valor)
    .map(([nombre]) => nombre)
  if (faltan.length) throw new Error(`Faltan variables de entorno de Redsys: ${faltan.join(', ')}`)
  return cfg as ConfigRedsys
}

/** Número de pedido válido: 4 primeras cifras y hasta 12 caracteres alfanuméricos. */
export function esPedidoValido(pedido: string): boolean {
  return /^\d{4}[0-9A-Za-z]{0,8}$/.test(pedido)
}

/** Pedido nuevo de 12 caracteres (4 cifras + 8 letras mayúsculas o cifras), aleatorio. */
export function nuevoPedido(): string {
  const alfabeto = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let pedido = String(randomInt(1000, 10000)) // 4 cifras
  for (let i = 0; i < 8; i++) pedido += alfabeto[randomInt(alfabeto.length)]
  return pedido
}

/**
 * Clave de firma de un pedido: se cifra el número de pedido (relleno con ceros
 * hasta múltiplo de 8 bytes) con 3DES-CBC, IV de ceros y sin relleno, usando la
 * clave secreta del comercio. El resultado es la clave del HMAC de esa operación.
 */
export function derivarClavePedido(claveSecretaBase64: string, pedido: string): Buffer {
  const clave = Buffer.from(claveSecretaBase64, 'base64')
  if (clave.length !== 24) throw new Error('La clave secreta de Redsys debe tener 24 bytes (base64)')
  const bytes = Buffer.from(pedido, 'utf8')
  const relleno = (8 - (bytes.length % 8)) % 8
  const entrada = Buffer.concat([bytes, Buffer.alloc(relleno)])
  const cifrador = createCipheriv('des-ede3-cbc', clave, Buffer.alloc(8))
  cifrador.setAutoPadding(false)
  return Buffer.concat([cifrador.update(entrada), cifrador.final()])
}

/** Firma (base64 estándar) de los parámetros ya codificados en base64. */
export function firmarParametros(claveSecretaBase64: string, pedido: string, parametrosBase64: string): string {
  const claveOperacion = derivarClavePedido(claveSecretaBase64, pedido)
  return createHmac('sha256', claveOperacion).update(parametrosBase64).digest('base64')
}

/** Crea los campos firmados del formulario que se envía a la pasarela. */
export function crearPeticionPago(cfg: ConfigRedsys, peticion: PeticionPago): FormularioRedsys {
  if (!esPedidoValido(peticion.pedido)) throw new Error('Número de pedido no válido para Redsys')
  if (!Number.isInteger(peticion.importeCentimos) || peticion.importeCentimos <= 0) {
    throw new Error('El importe debe ser un número entero de céntimos mayor que cero')
  }

  const parametros: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(peticion.importeCentimos),
    DS_MERCHANT_ORDER: peticion.pedido,
    DS_MERCHANT_MERCHANTCODE: cfg.codigoComercio,
    DS_MERCHANT_CURRENCY: MONEDA_EURO,
    DS_MERCHANT_TRANSACTIONTYPE: TRANSACCION_AUTORIZACION,
    DS_MERCHANT_TERMINAL: cfg.terminal,
    DS_MERCHANT_MERCHANTURL: peticion.urlNotificacion,
    DS_MERCHANT_URLOK: peticion.urlOk,
    DS_MERCHANT_URLKO: peticion.urlKo,
    DS_MERCHANT_MERCHANTNAME: CONCEPTO_COMERCIAL,
    DS_MERCHANT_PRODUCTDESCRIPTION: CONCEPTO_COMERCIAL,
    DS_MERCHANT_CONSUMERLANGUAGE: IDIOMA_ESPANOL,
  }
  // Bizum: "z"; tarjeta: "C". Si el banco lo tiene activado, evita que el
  // alumno elija otro método en la página de pago.
  parametros.DS_MERCHANT_PAYMETHODS = peticion.metodo === 'bizum' ? 'z' : 'C'

  const parametrosBase64 = Buffer.from(JSON.stringify(parametros), 'utf8').toString('base64')
  return {
    url: cfg.urlPasarela,
    campos: {
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: parametrosBase64,
      Ds_Signature: firmarParametros(cfg.claveSecreta, peticion.pedido, parametrosBase64),
    },
  }
}

export type NotificacionRedsys = {
  /** Firma válida. Si es false NO se debe confiar en nada de `parametros`. */
  valida: boolean
  parametros: Record<string, string>
  pedido: string | null
  /** Importe en céntimos según el banco, o null si falta. */
  importeCentimos: number | null
  /** Pago autorizado (código de respuesta de 0 a 99). */
  autorizado: boolean
  codigoRespuesta: string | null
  codigoAutorizacion: string | null
}

function aBase64Estandar(valor: string): string {
  return valor.replace(/-/g, '+').replace(/_/g, '/')
}

function aBase64Url(valor: string): string {
  return valor.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Verifica el aviso del banco (webhook). La firma llega en base64 "seguro para
 * URL"; se compara de forma segura en tiempo constante. Si la firma o los
 * parámetros no son válidos devuelve valida=false.
 */
export function verificarNotificacion(
  claveSecretaBase64: string,
  entrada: { Ds_MerchantParameters?: string; Ds_Signature?: string }
): NotificacionRedsys {
  const invalida: NotificacionRedsys = {
    valida: false,
    parametros: {},
    pedido: null,
    importeCentimos: null,
    autorizado: false,
    codigoRespuesta: null,
    codigoAutorizacion: null,
  }

  const parametrosBase64 = entrada.Ds_MerchantParameters
  const firmaRecibida = entrada.Ds_Signature
  if (!parametrosBase64 || !firmaRecibida) return invalida

  let parametros: Record<string, string>
  try {
    const json = Buffer.from(aBase64Estandar(parametrosBase64), 'base64').toString('utf8')
    parametros = JSON.parse(json)
  } catch {
    return invalida
  }

  // Redsys envía los nombres con distinta capitalización según la operación.
  const buscar = (nombre: string): string | null => {
    const clave = Object.keys(parametros).find((k) => k.toUpperCase() === nombre.toUpperCase())
    return clave ? String(parametros[clave]) : null
  }

  const pedido = buscar('Ds_Order')
  if (!pedido) return { ...invalida, parametros }

  let firmaEsperada: string
  try {
    firmaEsperada = firmarParametros(claveSecretaBase64, pedido, aBase64Estandar(parametrosBase64))
  } catch {
    return { ...invalida, parametros }
  }

  const a = Buffer.from(aBase64Url(firmaEsperada))
  const b = Buffer.from(aBase64Url(firmaRecibida))
  const valida = a.length === b.length && timingSafeEqual(a, b)
  if (!valida) return { ...invalida, parametros }

  const respuesta = buscar('Ds_Response')
  const importe = buscar('Ds_Amount')
  const numeroRespuesta = respuesta !== null && /^\d{1,4}$/.test(respuesta) ? Number(respuesta) : null

  return {
    valida: true,
    parametros,
    pedido,
    importeCentimos: importe !== null && /^\d+$/.test(importe) ? Number(importe) : null,
    autorizado: numeroRespuesta !== null && numeroRespuesta >= 0 && numeroRespuesta <= 99,
    codigoRespuesta: respuesta,
    codigoAutorizacion: buscar('Ds_AuthorisationCode'),
  }
}
