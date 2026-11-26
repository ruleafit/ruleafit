// HTML del simulador de TPV (sin JavaScript en el navegador). Todo texto variable se escapa.
import { formatearEuros } from './dinero.ts'
import { ESCENARIOS, RUTA_MOCK, type CamposFirmados, type Envio } from './mockTpv.ts'

export const escapar = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export type EstadoCobro = { pedido: string; importeCentimos: number; estado: string }

const oculto = (n: string, v: string) => `<input type="hidden" name="${escapar(n)}" value="${escapar(v)}">`

function boton(accion: string, texto: string, campos?: CamposFirmados, clase = '') {
  const firmados = campos ? Object.entries(campos).map(([n, v]) => oculto(n, v)).join('') : ''
  return `<form method="post" action="${RUTA_MOCK}">${firmados}${oculto('accion', accion)}<button class="${clase}">${escapar(texto)}</button></form>`
}

export function pagina(datos: {
  campos?: CamposFirmados
  cobro?: EstadoCobro
  plazas?: { ocupadas: number; maximas: number }
  envios?: Envio[]
  aviso?: string
}): string {
  const { campos, cobro, plazas, envios = [], aviso } = datos
  const filas = envios
    .map((e) => `<li>Pedido <b>${escapar(e.pedido)}</b> · código ${escapar(e.codigo)} → HTTP ${escapar(e.status)} · <b>${escapar(e.resultado)}</b></li>`)
    .join('')
  const resumen = cobro
    ? `<section><p>Pedido <b>${escapar(cobro.pedido)}</b> · ${escapar(formatearEuros(cobro.importeCentimos))}</p>
       <p>Estado del cobro: <b>${escapar(cobro.estado)}</b></p>
       ${plazas ? `<p>Plazas ocupadas: <b>${escapar(plazas.ocupadas)} de ${escapar(plazas.maximas)}</b></p>` : ''}</section>`
    : ''
  const pagos = campos
    ? `<h2>Simular la respuesta del banco</h2>
       ${boton('autorizar', ESCENARIOS.autorizar, campos, 'si')}
       ${boton('rechazar', ESCENARIOS.rechazar, campos, 'no')}
       ${boton('doble', ESCENARIOS.doble, campos)}
       ${boton('ultima_plaza', ESCENARIOS.ultima_plaza, campos)}`
    : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>TPV simulado · Ruleafit</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:1.5rem 1rem;color:#1F2400}
.franja{background:#fde68a;border:2px solid #b45309;padding:.75rem;font-weight:700;text-align:center}
button{width:100%;padding:.8rem;margin:.3rem 0;font-weight:700;border:2px solid #1F2400;background:#fff;cursor:pointer}
button.si{background:#B5E600}button.no{background:#fee2e2}section{border:1px solid #ccc;padding:0 1rem;margin:1rem 0}
.aviso{background:#fff7ed;border:1px solid #fb923c;padding:.75rem}li{margin:.4rem 0}</style></head><body>
<p class="franja">TPV SIMULADO · PRUEBAS · no se cobra dinero</p>
${resumen}
${aviso ? `<p class="aviso" role="status">${escapar(aviso)}</p>` : ''}
${filas ? `<h2>Respuesta del webhook</h2><ul>${filas}</ul>` : ''}
${pagos}
<h2>Devoluciones</h2>
<p>Primero cancela una reserva pagada (2 h antes o más) en Mis reservas. Después:</p>
${boton('devolver', 'Procesar las devoluciones pendientes (banco simulado: 0900)')}
<p><a href="${RUTA_MOCK}">Panel del simulador</a> · <a href="/mis-reservas">Mis reservas</a> · <a href="/clases">Sesiones</a></p>
</body></html>`
}
