import type { Alerta } from './alertas.ts'

type ClienteRpc = {
  rpc: (nombre: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>
}

/**
 * Solo servidor (recibe el cliente de servicio). Guarda la alerta y activa el freno si toca. NUNCA lanza:
 * avisar de un fallo no puede provocar otro.
 */
export async function registrarAlerta(admin: ClienteRpc, alerta: Alerta): Promise<void> {
  try {
    const { error } = await admin.rpc('registrar_alerta', {
      p_tipo: alerta.tipo,
      p_clave: alerta.clave,
      p_gravedad: alerta.gravedad,
      p_detalle: alerta.detalle,
      p_parar: alerta.parar ?? null,
      p_umbral: alerta.umbral ?? 1,
    })
    if (error) console.error('registrar_alerta falló:', error.code, alerta.clave)
  } catch {
    console.error('registrar_alerta no disponible:', alerta.clave)
  }
}
