// Alertas operativas (sql/099): qué alerta genera cada fallo y cómo se escribe el correo al administrador.
// Sin dependencias, para poder probarlo. Nunca se incluyen claves, tarjetas ni datos de personas.

export type Alerta = {
  tipo: 'webhook' | 'devoluciones' | 'cola' | 'cron'
  clave: string
  gravedad: 'aviso' | 'critica'
  detalle: string
  /** Freno que se activa (parada segura). */
  parar?: 'cobros' | 'devoluciones'
  /** Repeticiones seguidas necesarias para activar el freno. */
  umbral?: number
}

export const ALERTAS = {
  webhookSinConfigurar: (): Alerta => ({
    tipo: 'webhook', clave: 'webhook:sin_configurar', gravedad: 'critica',
    detalle: 'El aviso del banco ha llegado y Redsys no está configurado en el servidor.',
  }),
  // Cualquiera puede mandar una petición falsa: se avisa, pero NUNCA frena (si no, sería un botón de apagado público).
  webhookFirmaNoValida: (): Alerta => ({
    tipo: 'webhook', clave: 'webhook:firma_no_valida', gravedad: 'aviso',
    detalle: 'Aviso del banco con firma no válida (puede ser un intento ajeno o una clave mal puesta).',
  }),
  webhookErrorConfirmando: (codigo: string | undefined): Alerta => ({
    tipo: 'webhook', clave: 'webhook:error_confirmando', gravedad: 'critica',
    detalle: `No se ha podido confirmar un pago avisado por el banco (error ${codigo || 'desconocido'}).`,
    parar: 'cobros', umbral: 3,
  }),
  webhookAnomalo: (resultado: string, pedido: string): Alerta => ({
    tipo: 'webhook', clave: `webhook:${resultado}`, gravedad: 'critica',
    detalle: `Aviso firmado del banco con resultado «${resultado}» (pedido ${pedido}).`,
    parar: 'cobros',
  }),
  devolucionSinConfigurar: (): Alerta => ({
    tipo: 'devoluciones', clave: 'devoluciones:sin_configurar', gravedad: 'critica',
    detalle: 'El proceso de devoluciones no tiene Redsys configurado.',
  }),
  devolucionErrorBase: (codigo: string | undefined): Alerta => ({
    tipo: 'devoluciones', clave: 'devoluciones:error_base', gravedad: 'critica',
    detalle: `El proceso de devoluciones no ha podido reclamar trabajo (error ${codigo || 'desconocido'}).`,
  }),
  devolucionDudosa: (cobroId: string): Alerta => ({
    tipo: 'devoluciones', clave: 'devoluciones:dudosas', gravedad: 'critica',
    detalle: `No se sabe si el banco devolvió el dinero (cobro ${cobroId}). Revisar a mano. Devoluciones en pausa.`,
    parar: 'devoluciones',
  }),
  devolucionSinCerrar: (cobroId: string): Alerta => ({
    tipo: 'devoluciones', clave: 'devoluciones:sin_cerrar', gravedad: 'critica',
    detalle: `El banco respondió pero no se pudo guardar el resultado (cobro ${cobroId}). Revisar a mano. Devoluciones en pausa.`,
    parar: 'devoluciones',
  }),
  devolucionRechazada: (cobroId: string, codigo: string | null | undefined): Alerta => ({
    tipo: 'devoluciones', clave: 'devoluciones:rechazada', gravedad: 'aviso',
    detalle: `El banco ha rechazado una devolución (cobro ${cobroId}, código ${codigo || 'sin código'}).`,
    parar: 'devoluciones', umbral: 3,
  }),
  colaSinEnvio: (): Alerta => ({
    tipo: 'cola', clave: 'cola:sin_envio', gravedad: 'critica',
    detalle: 'El envío de notificaciones push está fallando (revisar las claves VAPID).',
  }),
}

export type AlertaGuardada = { gravedad: string; detalle: string; veces: number }
export type Paradas = { cobros?: boolean; devoluciones?: boolean } | null

export function correoDeAlertas(alertas: AlertaGuardada[], paradas: Paradas): { subject: string; text: string } {
  const criticas = alertas.filter((a) => a.gravedad === 'critica').length
  const frenos = [paradas?.cobros ? 'cobros nuevos' : null, paradas?.devoluciones ? 'devoluciones' : null].filter(Boolean)
  const subject = `[Ruleafit] ${criticas > 0 ? 'ALERTA CRÍTICA' : 'Aviso'}: ${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'} de pagos y procesos`
  const lineas = alertas.map(
    (a) => `- [${a.gravedad === 'critica' ? 'CRÍTICA' : 'aviso'}] ${a.detalle}${a.veces > 1 ? ` (${a.veces} veces)` : ''}`
  )
  const estado = frenos.length
    ? `PARADA SEGURA ACTIVA: ${frenos.join(' y ')} en pausa. Se reanuda a mano tras revisar la causa.`
    : 'Sin frenos activos.'
  return { subject, text: `${lineas.join('\n')}\n\n${estado}\nPanel: https://www.ruleafit.com/admin/alertas` }
}
