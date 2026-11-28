// Textos y documento imprimible de las facturas de Ruleafit (sql/116): comisión y suscripción Pro. Los importes llegan
// calculados de la base: aquí solo se les da formato.
import { formatearEuros } from './dinero.ts'

export const BLOQUEOS_FACTURA: Record<string, string> = {
  sin_datos_organizador: 'Faltan los datos fiscales del organizador',
  sin_datos_ruleafit: 'Faltan los datos fiscales de Ruleafit',
  zona_especial: 'Canarias, Ceuta o Melilla: impuesto sin definir',
}

export const SITUACIONES_FACTURA: Record<string, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
}

export const TIPOS_FACTURA: Record<string, string> = {
  comision: 'Comisión',
  pro: 'Pro',
}

interface Parte {
  nombre?: string
  nif?: string
  direccion?: string
}

export interface Factura {
  tipo: 'comision' | 'pro'
  estado: string
  numero: string | null
  emisor: Parte
  receptor: Parte
  concepto: string
  fecha_operacion: string
  emitida_en?: string | null
  base_centimos: number
  iva_bps: number
  iva_centimos: number
  total_centimos: number
  detalle?: { concepto: string; cobrado_centimos: number; comision_centimos: number }[]
}

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const fecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const porciento = (bps: number) => `${(bps / 100).toLocaleString('es-ES')} %`

/** Documento HTML autónomo para ver o guardar como PDF desde el navegador. */
export function htmlFactura(f: Factura): string {
  const borrador = f.estado === 'borrador'
  const parte = (titulo: string, p: Parte) =>
    `<div><h2>${titulo}</h2><p><strong>${escaparHtml(p.nombre || '—')}</strong><br>NIF: ${escaparHtml(p.nif || '—')}<br>${escaparHtml(p.direccion || '—')}</p></div>`
  const fila = (nombre: string, centimos: number) => `<tr><td>${nombre}</td><td>${formatearEuros(centimos)}</td></tr>`
  const detalle = f.detalle?.length
    ? `<h2>Reservas incluidas (informativo)</h2><p>Importes cobrados en nombre y por cuenta del destinatario. No forman parte de esta factura; solo se factura la comisión.</p><table><tr><th>Concepto</th><th>Cobrado</th><th>Comisión</th></tr>${f.detalle
        .map((d) => `<tr><td>${escaparHtml(d.concepto)}</td><td>${formatearEuros(d.cobrado_centimos)}</td><td>${formatearEuros(d.comision_centimos)}</td></tr>`)
        .join('')}</table>`
    : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(f.numero || 'Borrador de factura')}</title>
<style>body{font:14px system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1f2400}h1{font-size:22px}h2{font-size:13px;text-transform:uppercase;color:#6b7355}.partes{display:flex;flex-wrap:wrap;gap:32px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e2e6cf;padding:6px;text-align:left}td+td,th+th{text-align:right}.aviso{border:2px solid #b91c1c;color:#b91c1c;font-weight:700;padding:10px}</style></head><body>
${borrador ? '<p class="aviso">BORRADOR SIN VALIDEZ FISCAL · pendiente de revisión por el asesor</p>' : ''}
<h1>Factura ${escaparHtml(f.numero || '(sin número)')}</h1>
<p>Fecha de operación: ${fecha(f.fecha_operacion)}${f.emitida_en ? ` · Fecha de emisión: ${new Date(f.emitida_en).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}` : ''}</p>
<div class="partes">${parte('Emisor', f.emisor)}${parte('Destinatario', f.receptor)}</div>
<p>${escaparHtml(f.concepto)}</p>
<table>${fila('Base imponible', f.base_centimos)}${fila(`IVA ${porciento(f.iva_bps)}`, f.iva_centimos)}<tr><td><strong>Total</strong></td><td><strong>${formatearEuros(f.total_centimos)}</strong></td></tr></table>
${detalle}
</body></html>`
}
