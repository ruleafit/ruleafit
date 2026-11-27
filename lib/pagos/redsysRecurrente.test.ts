import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  crearPeticionCobroRecurrente,
  crearPeticionPago,
  firmarParametros,
  solicitarCobroRecurrente,
  verificarNotificacion,
  type ConfigRedsys,
} from './redsys.ts'

const CFG: ConfigRedsys = {
  codigoComercio: '999008881',
  terminal: '1',
  claveSecreta: Buffer.alloc(24, 7).toString('base64'),
  urlPasarela: 'https://sis-t.redsys.es:25443/sis/realizarPago',
}
const leer = (b64: string) => JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
const base = { pedido: '1234ABCD5678', importeCentimos: 4000, urlNotificacion: 'a', urlOk: 'b', urlKo: 'c' }
const datos = { pedido: '1234ABCD5678', importeCentimos: 4000, identificadorTarjeta: 'token-1', cofTxnid: 'txn-1' }

const firmado = (parametros: Record<string, string>) => {
  const b64 = Buffer.from(JSON.stringify(parametros)).toString('base64')
  return { Ds_MerchantParameters: b64, Ds_Signature: firmarParametros(CFG.claveSecreta, parametros.Ds_Order, b64) }
}
const banco = (cuerpo: unknown, status = 200) => (async () => new Response(JSON.stringify(cuerpo), { status })) as typeof fetch

test('el primer pago de una suscripción pide guardar la tarjeta; un pago normal no', () => {
  const p = leer(crearPeticionPago(CFG, { ...base, guardarTarjeta: true }).campos.Ds_MerchantParameters)
  assert.equal(p.DS_MERCHANT_IDENTIFIER, 'REQUIRED')
  assert.equal(p.DS_MERCHANT_COF_INI, 'S')
  assert.equal(p.DS_MERCHANT_COF_TYPE, 'R')
  const normal = leer(crearPeticionPago(CFG, base).campos.Ds_MerchantParameters)
  assert.equal('DS_MERCHANT_IDENTIFIER' in normal, false)
  assert.throws(() => crearPeticionPago(CFG, { ...base, metodo: 'bizum', guardarTarjeta: true }), /tarjeta/)
})

test('el aviso del banco entrega la referencia de la tarjeta', () => {
  const n = verificarNotificacion(CFG.claveSecreta, firmado({
    Ds_Order: datos.pedido, Ds_Amount: '4000', Ds_Response: '0000', Ds_Merchant_Identifier: 'token-1', Ds_Merchant_Cof_Txnid: 'txn-1',
  }))
  assert.equal(n.identificadorTarjeta, 'token-1')
  assert.equal(n.cofTxnid, 'txn-1')
})

test('petición de cobro recurrente', () => {
  const p = leer(crearPeticionCobroRecurrente(CFG, datos).Ds_MerchantParameters)
  assert.equal(p.DS_MERCHANT_AMOUNT, '4000')
  assert.equal(p.DS_MERCHANT_COF_INI, 'N')
  assert.equal(p.DS_MERCHANT_EXCEP_SCA, 'MIT')
  assert.equal(p.DS_MERCHANT_COF_TXNID, 'txn-1')
  assert.throws(() => crearPeticionCobroRecurrente(CFG, { ...datos, identificadorTarjeta: '' }), /tarjeta/)
  assert.throws(() => crearPeticionCobroRecurrente(CFG, { ...datos, importeCentimos: 0 }), /céntimos/)
})

test('solo cuenta como cobrado una respuesta firmada, autorizada y con el mismo importe', async () => {
  const ok = { Ds_Order: datos.pedido, Ds_Amount: '4000', Ds_Response: '0000' }
  const r = async (llamar: typeof fetch) => (await solicitarCobroRecurrente(CFG, datos, llamar)).resultado
  assert.equal(await r(banco(firmado(ok))), 'cobrado')
  assert.equal(await r(banco(firmado({ ...ok, Ds_Response: '0190' }))), 'denegado')
  assert.equal(await r(banco({ errorCode: 'SIS0042' })), 'denegado')
  assert.equal(await r(banco(firmado({ ...ok, Ds_Amount: '1' }))), 'desconocido')
  assert.equal(await r(banco({ ...firmado(ok), Ds_Signature: 'falsa' })), 'desconocido')
  assert.equal(await r(banco(firmado(ok), 500)), 'desconocido')
  assert.equal(await r((async () => { throw new Error('red') }) as typeof fetch), 'desconocido')
})
