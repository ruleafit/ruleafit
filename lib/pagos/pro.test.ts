import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearPeticionPago, verificarNotificacion, type ConfigRedsys } from './redsys.ts'
import { bancoSimuladoRecurrente, ejecutarEscenario, leerPeticionDeCobro, type CamposFirmados } from './mockTpv.ts'
import { procesarRenovaciones } from './procesarRenovaciones.ts'

const CFG: ConfigRedsys = {
  codigoComercio: '999008881', terminal: '1', claveSecreta: Buffer.alloc(24, 3).toString('base64'), urlPasarela: '/api/payments/mock-tpv',
}

/** Base de datos de mentira: entrega las renovaciones de la lista y apunta lo que se le pide. */
function base(pendientes: number, falla?: string) {
  const llamadas: [string, any][] = []
  return {
    llamadas,
    rpc: async (nombre: string, args?: any) => {
      llamadas.push([nombre, args])
      if (nombre === falla) return { error: { code: 'XX000' } }
      if (nombre === 'reclamar_renovacion_pro') {
        if (pendientes <= 0) return { data: { resultado: 'nada_pendiente' }, error: null }
        pendientes--
        return { data: { resultado: 'reclamada', pedido: args.p_pedido, importe_centimos: 4000, identificador: 'SIM-1', cof_txnid: 'T' }, error: null }
      }
      return { data: { ok: true }, error: null }
    },
  }
}
const confirmaciones = (b: ReturnType<typeof base>) => b.llamadas.filter(([n]) => n === 'confirmar_pago_pro').map(([, a]) => a.p_autorizado)

test('cobra o deniega cada renovación y lo guarda', async () => {
  const si = base(2)
  assert.deepEqual((await procesarRenovaciones(si, CFG, bancoSimuladoRecurrente(CFG, true))).cuerpo, { ok: true, cobradas: 2, denegadas: 0, dudosas: 0 })
  assert.deepEqual(confirmaciones(si), [true, true])
  const no = base(1)
  assert.equal((await procesarRenovaciones(no, CFG, bancoSimuladoRecurrente(CFG, false))).cuerpo.denegadas, 1)
  assert.deepEqual(confirmaciones(no), [false])
})

test('sin respuesta fiable no confirma, marca dudosa y para la tanda', async () => {
  const b = base(3)
  const r = await procesarRenovaciones(b, CFG, (async () => { throw new Error('red') }) as typeof fetch)
  assert.equal(r.cuerpo.dudosas, 1)
  assert.deepEqual(confirmaciones(b), [])
  assert.equal(b.llamadas.filter(([n]) => n === 'reclamar_renovacion_pro').length, 1)
  assert.ok(b.llamadas.some(([n]) => n === 'marcar_pago_pro_dudoso'))
})

test('errores de la base de datos y parada segura', async () => {
  assert.equal((await procesarRenovaciones(base(1, 'reclamar_renovacion_pro'), CFG, bancoSimuladoRecurrente(CFG, true))).status, 500)
  assert.equal((await procesarRenovaciones(base(1, 'confirmar_pago_pro'), CFG, bancoSimuladoRecurrente(CFG, true))).cuerpo.dudosas, 1)
  const parado = { rpc: async () => ({ data: { resultado: 'parado' }, error: null }) }
  assert.equal((await procesarRenovaciones(parado, CFG, bancoSimuladoRecurrente(CFG, true))).cuerpo.parado, true)
})

test('el simulador entrega la referencia de la tarjeta solo en el alta de Pro autorizada', async () => {
  for (const [guardarTarjeta, escenario, esperado] of [[true, 'autorizar', true], [true, 'rechazar', false], [false, 'autorizar', false]] as const) {
    const f = crearPeticionPago(CFG, { pedido: '1234ABCD5678', importeCentimos: 4000, urlNotificacion: 'a', urlOk: 'b', urlKo: 'c', guardarTarjeta })
    const cobro = leerPeticionDeCobro(CFG, f.campos)!
    let aviso: CamposFirmados | undefined
    await ejecutarEscenario(escenario, { cfg: CFG, cobro, rivales: [], plazasLibres: 0, enviar: async (a) => { aviso = a; return { status: 200, resultado: 'x' } } })
    const n = verificarNotificacion(CFG.claveSecreta, aviso!)
    assert.equal(n.valida, true)
    assert.equal(n.identificadorTarjeta !== null, esperado)
  }
})
