import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALERTAS, correoDeAlertas } from './alertas.ts'
import { registrarAlerta } from './registrarAlerta.ts'

test('una firma no válida nunca activa un freno (cualquiera puede enviarla)', () => {
  assert.equal(ALERTAS.webhookFirmaNoValida().parar, undefined)
})

test('parada segura: qué fallos frenan y cuándo', () => {
  assert.equal(ALERTAS.webhookAnomalo('importe_no_coincide', '1').parar, 'cobros')
  assert.equal(ALERTAS.webhookErrorConfirmando('X').umbral, 3)
  assert.equal(ALERTAS.devolucionDudosa('c').parar, 'devoluciones')
  assert.equal(ALERTAS.devolucionSinCerrar('c').parar, 'devoluciones')
  assert.equal(ALERTAS.devolucionRechazada('c', '0190').umbral, 3)
})

test('la revisión SQL no usa (ni cierra) las claves que registra la web', () => {
  const sql = readFileSync(new URL('../../sql/099_alertas_operativas.sql', import.meta.url), 'utf8')
  const claves = [
    ALERTAS.webhookSinConfigurar(), ALERTAS.webhookFirmaNoValida(), ALERTAS.webhookErrorConfirmando('x'),
    ALERTAS.webhookAnomalo('desconocido', '1'), ALERTAS.webhookAnomalo('importe_no_coincide', '1'),
    ALERTAS.devolucionSinConfigurar(), ALERTAS.devolucionErrorBase('x'), ALERTAS.devolucionDudosa('c'),
    ALERTAS.devolucionSinCerrar('c'), ALERTAS.devolucionRechazada('c', 'x'), ALERTAS.colaSinEnvio(),
  ].map((a) => a.clave)
  for (const clave of claves) assert.ok(!sql.includes(`'${clave}'`), clave)
})

test('correo: asunto según gravedad, repeticiones y frenos', () => {
  const critico = correoDeAlertas(
    [{ gravedad: 'critica', detalle: 'Falla A', veces: 4 }, { gravedad: 'aviso', detalle: 'Falla B', veces: 1 }],
    { cobros: true, devoluciones: false }
  )
  assert.match(critico.subject, /ALERTA CRÍTICA: 2 alertas/)
  assert.match(critico.text, /Falla A \(4 veces\)/)
  assert.match(critico.text, /PARADA SEGURA ACTIVA: cobros nuevos en pausa/)
  const leve = correoDeAlertas([{ gravedad: 'aviso', detalle: 'B', veces: 1 }], null)
  assert.match(leve.subject, /Aviso: 1 alerta /)
  assert.match(leve.text, /Sin frenos activos/)
})

test('registrarAlerta envía los datos y nunca lanza', async () => {
  let recibido: unknown
  await registrarAlerta({ rpc: async (n, a) => ((recibido = { n, a }), { error: null }) }, ALERTAS.devolucionDudosa('abc'))
  assert.deepEqual((recibido as { a: Record<string, unknown> }).a.p_parar, 'devoluciones')
  const original = console.error
  console.error = () => {}
  try {
    await registrarAlerta({ rpc: async () => ({ error: { code: '42883' } }) }, ALERTAS.colaSinEnvio())
    await registrarAlerta({ rpc: () => { throw new Error('sin red') } }, ALERTAS.colaSinEnvio())
  } finally {
    console.error = original
  }
})
