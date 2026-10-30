import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  configRedsysDesdeEntorno,
  crearPeticionPago,
  derivarClavePedido,
  esPedidoValido,
  firmarParametros,
  nuevoPedido,
  verificarNotificacion,
  type ConfigRedsys,
} from './redsys.ts'

// Clave de pruebas pública de la documentación de Redsys (no es un secreto).
const CLAVE_PRUEBAS = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7'

const CFG: ConfigRedsys = {
  codigoComercio: '999008881',
  terminal: '1',
  claveSecreta: CLAVE_PRUEBAS,
  urlPasarela: 'https://sis-t.redsys.es:25443/sis/realizarPago',
}

test('clave derivada y firma: contrastadas con una implementación independiente (OpenSSL)', () => {
  // Valores obtenidos con la línea de órdenes de OpenSSL (3DES-CBC sin relleno
  // y HMAC-SHA256), no con este código. NO son un ejemplo oficial de Redsys: la
  // validación definitiva es contra su entorno de pruebas.
  assert.equal(
    derivarClavePedido(CLAVE_PRUEBAS, '1446117555').toString('hex'),
    'f318a5942e4f6d5a3c14fd11f8879540'
  )
  const parametros =
    'eyJEU19NRVJDSEFOVF9BTU9VTlQiOiIxNDUiLCJEU19NRVJDSEFOVF9PUkRFUiI6IjE0NDYxMTc1NTUiLCJEU19NRVJDSEFOVF9NRVJDSEFOVENPREUiOiI5OTkwMDg4ODEiLCJEU19NRVJDSEFOVF9DVVJSRU5DWSI6Ijk3OCIsIkRTX01FUkNIQU5UX1RSQU5TQUNUSU9OVFlQRSI6IjAiLCJEU19NRVJDSEFOVF9URVJNSU5BTCI6Ijg3MSIsIkRTX01FUkNIQU5UX01FUkNIQU5UVVJMIjoiIiwiRFNfTUVSQ0hBTlRfVVJMT0siOiIiLCJEU19NRVJDSEFOVF9VUkxLTyI6IiJ9'
  assert.equal(
    firmarParametros(CLAVE_PRUEBAS, '1446117555', parametros),
    'AbaniRiUgKv0KR4qcb1+Z8q+xGUnAGLNLnPOaBAonwg='
  )
})

test('derivarClavePedido rechaza claves que no son de 24 bytes', () => {
  assert.throws(() => derivarClavePedido('AAAA', '1234ABCD'), /24 bytes/)
})

test('esPedidoValido y nuevoPedido', () => {
  assert.ok(esPedidoValido('1446117555'))
  assert.ok(esPedidoValido('1234ABCD5678'))
  assert.ok(esPedidoValido('1234'))
  assert.ok(!esPedidoValido('123')) // menos de 4 cifras
  assert.ok(!esPedidoValido('ABCD1234')) // no empieza por 4 cifras
  assert.ok(!esPedidoValido('1234ABCD56789')) // más de 12
  assert.ok(!esPedidoValido('1234AB-D'))
  const vistos = new Set<string>()
  for (let i = 0; i < 500; i++) {
    const p = nuevoPedido()
    assert.equal(p.length, 12)
    assert.ok(esPedidoValido(p), p)
    vistos.add(p)
  }
  assert.equal(vistos.size, 500) // sin repeticiones en la práctica
})

test('crearPeticionPago: campos, concepto RULEAFIT y firma coherente', () => {
  const f = crearPeticionPago(CFG, {
    pedido: '1234ABCD5678',
    importeCentimos: 1250,
    urlNotificacion: 'https://www.ruleafit.com/api/payments/redsys-webhook',
    urlOk: 'https://www.ruleafit.com/pagos/ok',
    urlKo: 'https://www.ruleafit.com/pagos/ko',
  })
  assert.equal(f.url, CFG.urlPasarela)
  assert.equal(f.campos.Ds_SignatureVersion, 'HMAC_SHA256_V1')
  const p = JSON.parse(Buffer.from(f.campos.Ds_MerchantParameters, 'base64').toString('utf8'))
  assert.equal(p.DS_MERCHANT_AMOUNT, '1250')
  assert.equal(p.DS_MERCHANT_ORDER, '1234ABCD5678')
  assert.equal(p.DS_MERCHANT_MERCHANTCODE, '999008881')
  assert.equal(p.DS_MERCHANT_CURRENCY, '978')
  assert.equal(p.DS_MERCHANT_TRANSACTIONTYPE, '0')
  assert.equal(p.DS_MERCHANT_MERCHANTNAME, 'RULEAFIT')
  assert.equal(p.DS_MERCHANT_PRODUCTDESCRIPTION, 'RULEAFIT')
  assert.equal(p.DS_MERCHANT_PAYMETHODS, 'C')
  assert.equal(
    f.campos.Ds_Signature,
    firmarParametros(CLAVE_PRUEBAS, '1234ABCD5678', f.campos.Ds_MerchantParameters)
  )
  const bizum = crearPeticionPago(CFG, {
    pedido: '1234ABCD5678', importeCentimos: 100, urlNotificacion: 'a', urlOk: 'b', urlKo: 'c', metodo: 'bizum',
  })
  assert.equal(JSON.parse(Buffer.from(bizum.campos.Ds_MerchantParameters, 'base64').toString()).DS_MERCHANT_PAYMETHODS, 'z')
})

test('crearPeticionPago rechaza pedidos e importes no válidos', () => {
  const base = { urlNotificacion: 'a', urlOk: 'b', urlKo: 'c' }
  assert.throws(() => crearPeticionPago(CFG, { ...base, pedido: 'mal', importeCentimos: 100 }), /pedido/)
  for (const importe of [0, -5, 10.5, NaN]) {
    assert.throws(() => crearPeticionPago(CFG, { ...base, pedido: '1234ABCD5678', importeCentimos: importe }), /importe/)
  }
})

// Construye una notificación como la enviaría el banco: parámetros en base64 "URL"
// y firma en base64 "URL", calculada con la clave del pedido.
function notificacion(parametros: Record<string, string>, clave = CLAVE_PRUEBAS) {
  const estandar = Buffer.from(JSON.stringify(parametros), 'utf8').toString('base64')
  const pedido = parametros.Ds_Order ?? parametros.DS_ORDER
  const firma = firmarParametros(clave, pedido, estandar)
  const url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_')
  return { Ds_MerchantParameters: url(estandar), Ds_Signature: url(firma) }
}

test('verificarNotificacion: pago autorizado', () => {
  const n = verificarNotificacion(
    CLAVE_PRUEBAS,
    notificacion({ Ds_Order: '1234ABCD5678', Ds_Amount: '1250', Ds_Response: '0000', Ds_AuthorisationCode: '123456' })
  )
  assert.equal(n.valida, true)
  assert.equal(n.autorizado, true)
  assert.equal(n.pedido, '1234ABCD5678')
  assert.equal(n.importeCentimos, 1250)
  assert.equal(n.codigoAutorizacion, '123456')
})

test('verificarNotificacion: códigos de respuesta', () => {
  const resp = (codigo: string) =>
    verificarNotificacion(CLAVE_PRUEBAS, notificacion({ Ds_Order: '1234ABCD5678', Ds_Amount: '100', Ds_Response: codigo }))
  assert.equal(resp('0000').autorizado, true)
  assert.equal(resp('0099').autorizado, true)
  assert.equal(resp('0100').autorizado, false) // denegada
  assert.equal(resp('0190').autorizado, false)
  assert.equal(resp('9915').autorizado, false) // cancelada por el usuario
  assert.equal(resp('abcd').autorizado, false)
})

test('verificarNotificacion acepta nombres en mayúsculas', () => {
  const n = verificarNotificacion(
    CLAVE_PRUEBAS,
    notificacion({ DS_ORDER: '1234ABCD5678', DS_AMOUNT: '500', DS_RESPONSE: '0000' })
  )
  assert.equal(n.valida, true)
  assert.equal(n.importeCentimos, 500)
})

test('verificarNotificacion rechaza firmas falsas, datos manipulados y entradas incompletas', () => {
  const buena = notificacion({ Ds_Order: '1234ABCD5678', Ds_Amount: '1250', Ds_Response: '0000' })

  // Clave distinta
  assert.equal(verificarNotificacion('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', buena).valida, false)

  // Firma alterada
  const firmaMala = { ...buena, Ds_Signature: 'A' + buena.Ds_Signature.slice(1) }
  assert.equal(verificarNotificacion(CLAVE_PRUEBAS, firmaMala).valida, false)

  // Parámetros alterados (el importe) con la firma original
  const manipulada = notificacion({ Ds_Order: '1234ABCD5678', Ds_Amount: '1', Ds_Response: '0000' })
  const mezcla = { Ds_MerchantParameters: manipulada.Ds_MerchantParameters, Ds_Signature: buena.Ds_Signature }
  const r = verificarNotificacion(CLAVE_PRUEBAS, mezcla)
  assert.equal(r.valida, false)
  assert.equal(r.autorizado, false)

  // Entradas incompletas o basura
  assert.equal(verificarNotificacion(CLAVE_PRUEBAS, {}).valida, false)
  assert.equal(verificarNotificacion(CLAVE_PRUEBAS, { Ds_MerchantParameters: 'xxx', Ds_Signature: 'yyy' }).valida, false)
  assert.equal(
    verificarNotificacion(CLAVE_PRUEBAS, {
      Ds_MerchantParameters: Buffer.from('{"x":"1"}').toString('base64'),
      Ds_Signature: 'abc',
    }).valida,
    false
  )
})

test('configRedsysDesdeEntorno', () => {
  const cfg = configRedsysDesdeEntorno({
    REDSYS_MERCHANT_CODE: '999008881',
    REDSYS_SECRET_KEY: CLAVE_PRUEBAS,
    REDSYS_URL: 'https://x',
  } as NodeJS.ProcessEnv)
  assert.equal(cfg.terminal, '1') // por defecto
  assert.throws(() => configRedsysDesdeEntorno({} as NodeJS.ProcessEnv), /REDSYS_MERCHANT_CODE, REDSYS_SECRET_KEY, REDSYS_URL/)
})
