import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crearPeticionPago, solicitarDevolucion, verificarNotificacion, type ConfigRedsys } from './redsys.ts'
import {
  REF_SUPABASE_PRODUCCION,
  RUTA_MOCK,
  bancoSimuladoDevolucion,
  crearAvisoDelBanco,
  ejecutarEscenario,
  esEscenario,
  leerPeticionDeCobro,
  permisoMockTpv,
  type CamposFirmados,
} from './mockTpv.ts'
import { pagina } from './mockTpvPagina.ts'
import { procesarDevoluciones } from './procesarDevoluciones.ts'

const CFG: ConfigRedsys = {
  codigoComercio: '999008881',
  terminal: '1',
  claveSecreta: 'sq7HjrUOBfKmC576ILgskD5srU870gJ7', // clave pública de pruebas de Redsys
  urlPasarela: RUTA_MOCK,
}

const PREVIEW = {
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  NODE_ENV: 'production',
  MOCK_TPV_ACTIVO: 'true',
  REDSYS_URL: RUTA_MOCK,
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdpruebas.supabase.co',
  MOCK_TPV_SUPABASE_REF: 'abcdpruebas',
}

test('permiso: Preview y local con base de pruebas', () => {
  assert.equal(permisoMockTpv(PREVIEW).permitido, true)
  const local = { ...PREVIEW, VERCEL: undefined, VERCEL_ENV: undefined, NODE_ENV: 'development' }
  assert.equal(permisoMockTpv(local).permitido, true)
  assert.equal(
    permisoMockTpv({ ...local, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', MOCK_TPV_SUPABASE_REF: 'local' }).permitido,
    true
  )
})

test('permiso: en producción NUNCA, tenga las variables que tenga', () => {
  for (const extra of [{}, { NODE_ENV: 'development' }, { VERCEL: undefined }]) {
    assert.equal(permisoMockTpv({ ...PREVIEW, ...extra, VERCEL_ENV: 'production' }).permitido, false)
  }
})

test('permiso: se niega ante cualquier duda', () => {
  const casos: Record<string, string | undefined>[] = [
    { VERCEL_ENV: undefined }, // en Vercel sin entorno conocido
    { VERCEL_ENV: undefined, VERCEL: undefined, NODE_ENV: 'production' }, // servidor propio en producción
    { VERCEL_ENV: 'staging' },
    { MOCK_TPV_ACTIVO: undefined },
    { MOCK_TPV_ACTIVO: 'TRUE' },
    { REDSYS_URL: 'https://sis-t.redsys.es:25443/sis/realizarPago' },
    { REDSYS_URL: 'https://sis.redsys.es/sis/realizarPago' },
    { MOCK_TPV_SUPABASE_REF: undefined },
    { MOCK_TPV_SUPABASE_REF: 'otro' },
    { NEXT_PUBLIC_SUPABASE_URL: undefined },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://db.ejemplo.com' },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${REF_SUPABASE_PRODUCCION}.supabase.co`, MOCK_TPV_SUPABASE_REF: REF_SUPABASE_PRODUCCION },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${REF_SUPABASE_PRODUCCION.toUpperCase()}.SUPABASE.CO`, MOCK_TPV_SUPABASE_REF: REF_SUPABASE_PRODUCCION },
  ]
  for (const extra of casos) assert.equal(permisoMockTpv({ ...PREVIEW, ...extra }).permitido, false, JSON.stringify(extra))
})

test('la petición de cobro de la web se lee solo con firma válida', () => {
  const { campos } = crearPeticionPago(CFG, {
    pedido: '2611ABCD0001', importeCentimos: 600, urlNotificacion: 'x', urlOk: 'x', urlKo: 'x',
  })
  assert.deepEqual(leerPeticionDeCobro(CFG, campos), { pedido: '2611ABCD0001', importeCentimos: 600 })
  assert.equal(leerPeticionDeCobro(CFG, { ...campos, Ds_Signature: 'AAAA' }), null)
  const alterado = Buffer.from(
    Buffer.from(campos.Ds_MerchantParameters, 'base64').toString('utf8').replace('"600"', '"1"')
  ).toString('base64')
  assert.equal(leerPeticionDeCobro(CFG, { ...campos, Ds_MerchantParameters: alterado }), null)
  assert.equal(leerPeticionDeCobro(CFG, {}), null)
  // Un aviso del banco no sirve como petición de cobro.
  assert.equal(leerPeticionDeCobro(CFG, crearAvisoDelBanco(CFG, { pedido: '2611ABCD0001', importeCentimos: 600, codigo: '0000' })), null)
})

test('los avisos simulados pasan la verificación del webhook real', () => {
  for (const [codigo, autorizado] of [['0000', true], ['0190', false]] as const) {
    const n = verificarNotificacion(CFG.claveSecreta, crearAvisoDelBanco(CFG, { pedido: '2611ABCD0001', importeCentimos: 600, codigo }))
    assert.equal(n.valida, true)
    assert.equal(n.autorizado, autorizado)
    assert.equal(n.importeCentimos, 600)
    assert.equal(n.codigoRespuesta, codigo)
  }
})

test('escenarios: qué avisos se envían', async () => {
  const enviados: CamposFirmados[] = []
  const base = {
    cfg: CFG,
    cobro: { pedido: '2611ABCD0001', importeCentimos: 600 },
    rivales: [{ pedido: '2611ABCD0002', importeCentimos: 600 }],
    plazasLibres: 1,
    enviar: async (a: CamposFirmados) => (enviados.push(a), { status: 200, resultado: 'x' }),
  }
  const codigos = async (e: Parameters<typeof ejecutarEscenario>[0]) =>
    (await ejecutarEscenario(e, base)).envios.map((x) => `${x.pedido.slice(-1)}:${x.codigo}`)
  assert.deepEqual(await codigos('autorizar'), ['1:0000'])
  assert.deepEqual(await codigos('rechazar'), ['1:0190'])
  enviados.length = 0
  assert.deepEqual(await codigos('doble'), ['1:0000', '1:0000'])
  assert.deepEqual(enviados[0], enviados[1]) // exactamente el mismo aviso
  assert.deepEqual(await codigos('ultima_plaza'), ['1:0000', '2:0000'])
})

test('última plaza: explica qué falta en vez de enviar', async () => {
  const base = { cfg: CFG, cobro: { pedido: '2611ABCD0001', importeCentimos: 600 }, enviar: async () => assert.fail('no debe enviar') }
  const sinRival = await ejecutarEscenario('ultima_plaza', { ...base, rivales: [], plazasLibres: 1 })
  assert.match(sinRival.aviso!, /segundo pago/)
  const conHueco = await ejecutarEscenario('ultima_plaza', { ...base, rivales: [base.cobro], plazasLibres: 3 })
  assert.match(conHueco.aviso!, /1 plaza libre/)
  assert.equal(esEscenario('toString'), false)
})

test('banco simulado: la devolución se confirma con 0900 firmado y rechaza peticiones sin firma', async () => {
  const datos = { pedido: '2611ABCD0001', importeCentimos: 600 }
  const r = await solicitarDevolucion(CFG, datos, bancoSimuladoDevolucion(CFG))
  assert.deepEqual([r.resultado, r.codigoRespuesta], ['confirmada', '0900'])
  const otraClave = { ...CFG, claveSecreta: Buffer.alloc(24, 7).toString('base64') }
  assert.equal((await solicitarDevolucion(otraClave, datos, bancoSimuladoDevolucion(CFG))).resultado, 'rechazada')
})

function adminFalso(respuestas: Record<string, unknown[]>) {
  const llamadas: { nombre: string; args?: Record<string, unknown> }[] = []
  return {
    llamadas,
    rpc: async (nombre: string, args?: Record<string, unknown>) => {
      llamadas.push({ nombre, args })
      if (nombre === 'estado_paradas') return { data: respuestas.estado_paradas?.shift() ?? { devoluciones: false }, error: null }
      return { data: respuestas[nombre]?.shift() ?? null, error: null }
    },
  }
}
const reclamada = { resultado: 'reclamada', cobro_id: 'c1', pedido: '2611ABCD0001', importe_centimos: 600 }

test('devolución de principio a fin hasta completada', async () => {
  const admin = adminFalso({ reclamar_devolucion: [reclamada, { resultado: 'nada_pendiente' }] })
  const r = await procesarDevoluciones(admin, CFG, bancoSimuladoDevolucion(CFG))
  assert.deepEqual(r.cuerpo, { ok: true, completadas: 1, rechazadas: 0, dudosas: 0 })
  const cierre = admin.llamadas.find((l) => l.nombre === 'completar_devolucion')!
  assert.equal(cierre.args!.p_confirmada, true)
  assert.equal(cierre.args!.p_codigo_respuesta, '0900')
})

test('devoluciones: con el freno puesto no se reclama nada; sin respuesta del banco se corta', async () => {
  const frenado = adminFalso({ estado_paradas: [{ devoluciones: true }] })
  assert.equal((await procesarDevoluciones(frenado, CFG, bancoSimuladoDevolucion(CFG))).cuerpo.parado, true)
  assert.ok(!frenado.llamadas.some((l) => l.nombre === 'reclamar_devolucion'))

  const admin = adminFalso({ reclamar_devolucion: [reclamada, reclamada] })
  const original = console.error
  console.error = () => {}
  try {
    const r = await procesarDevoluciones(admin, CFG, async () => { throw new Error('sin red') })
    assert.equal(r.cuerpo.dudosas, 1)
  } finally {
    console.error = original
  }
  assert.equal(admin.llamadas.filter((l) => l.nombre === 'reclamar_devolucion').length, 1)
  assert.ok(!admin.llamadas.some((l) => l.nombre === 'completar_devolucion'))
  assert.equal(admin.llamadas.find((l) => l.nombre === 'registrar_alerta')!.args!.p_parar, 'devoluciones')
})

test('la página escapa el contenido y solo ofrece pagar si hay una petición firmada', () => {
  const sin = pagina({ aviso: '<script>alert(1)</script>' })
  assert.ok(!sin.includes('<script>'))
  assert.ok(!sin.includes('value="autorizar"'))
  const con = pagina({ campos: { Ds_SignatureVersion: 'v', Ds_MerchantParameters: '"><img>', Ds_Signature: 'f' } })
  assert.ok(con.includes('value="autorizar"') && con.includes('value="ultima_plaza"'))
  assert.ok(!con.includes('<img>'))
})

test('la referencia de producción del código es la que se protege', () => {
  assert.match(REF_SUPABASE_PRODUCCION, /^[a-z]{20}$/)
  const ruta = readFileSync(new URL('../../app/api/payments/mock-tpv/route.js', import.meta.url), 'utf8')
  // Las dos entradas de la ruta comprueban el permiso antes de hacer nada.
  assert.equal(ruta.match(/noExiste\(\)/g)!.length, 3)
})
