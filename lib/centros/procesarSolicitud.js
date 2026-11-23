// Lógica del endpoint público /api/centros/solicitud (N15), separada de Next.js para poder probarla.
// Orden: comprobaciones anti-spam → validación en el servidor → guardar PRIMERO en Supabase → avisar por correo.
// Si el correo falla, la solicitud queda guardada y no se duplica: un reintento (el mismo envío otra vez)
// recupera la misma solicitud y vuelve a intentar solo el aviso.
import { validarSolicitud, TIPOS_SOLICITUD } from './validarSolicitud.js'

export const MS_MINIMO_FORMULARIO = 2500 // ninguna persona rellena el formulario en menos de 2,5 s

export function construirCorreo(v, id) {
  return {
    asunto: `Nueva solicitud de centro: ${v.centro}`.slice(0, 150),
    texto: [
      `Nueva solicitud desde /centros (${TIPOS_SOLICITUD[v.tipo]})`,
      '',
      `Centro: ${v.centro}`,
      `Ciudad o municipio: ${v.ciudad}`,
      `Persona de contacto: ${v.contacto}`,
      `Correo: ${v.email}`,
      `Teléfono: ${v.telefono || '(no indicado)'}`,
      `Qué necesita: ${TIPOS_SOLICITUD[v.tipo]}`,
      `Mensaje: ${v.mensaje || '(sin mensaje)'}`,
      '',
      `Referencia: ${id}`,
      'Estado inicial: Nuevo contacto. Gestión en Supabase (tabla solicitudes_centros).',
    ].join('\n'),
  }
}

// entrada: { cuerpo, origen, host, admin, enviarCorreo, correoAdmin }
//   admin.rpc(...) y admin.from(...) = cliente de Supabase con clave de servicio
//   enviarCorreo({ para, respuestaA, asunto, texto }) → { error }
// Devuelve { estado, json }.
export async function procesarSolicitud({ cuerpo, origen, host, admin, enviarCorreo, correoAdmin, registrarError = console.error }) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { estado: 400, json: { error: 'Solicitud no válida.' } }
  }

  // Solo desde la propia web (los navegadores envían Origin en los POST).
  if (origen) {
    let origenHost = ''
    try {
      origenHost = new URL(origen).host
    } catch {
      origenHost = ''
    }
    if (!host || origenHost !== host) return { estado: 403, json: { error: 'Origen no permitido.' } }
  }

  // Campo trampa: un navegador normal lo deja vacío. Se responde «bien» sin guardar nada.
  if (typeof cuerpo.web === 'string' && cuerpo.web.trim() !== '') return { estado: 200, json: { ok: true } }
  // Tiempo mínimo desde que se mostró el formulario.
  if (!(Number(cuerpo.ms) >= MS_MINIMO_FORMULARIO)) {
    return { estado: 400, json: { error: 'No hemos podido enviar la solicitud. Inténtalo de nuevo.' } }
  }

  const { errores, valores } = validarSolicitud(cuerpo)
  if (Object.keys(errores).length > 0) return { estado: 400, json: { error: 'Revisa los datos del formulario.', errores } }

  // 1) Guardar primero.
  const { data, error } = await admin.rpc('registrar_solicitud_centro', {
    p_centro: valores.centro,
    p_ciudad: valores.ciudad,
    p_contacto: valores.contacto,
    p_email: valores.email,
    p_telefono: valores.telefono || null,
    p_tipo: valores.tipo,
    p_mensaje: valores.mensaje || null,
    p_privacidad: valores.privacidad,
  })
  if (error || !data) {
    const m = String(error?.message || '')
    if (m.includes('limite_global') || m.includes('limite_correo')) {
      return { estado: 429, json: { error: 'Hemos recibido muchas solicitudes. Inténtalo de nuevo más tarde.' } }
    }
    registrarError('Error guardando solicitud de centro:', m)
    return { estado: 500, json: { error: 'No hemos podido guardar la solicitud. Inténtalo de nuevo en unos minutos.' } }
  }

  // 2) Avisar por correo solo si la solicitud es nueva o su aviso sigue pendiente (reintento sin duplicados).
  if (data.aviso_pendiente) {
    if (!correoAdmin) {
      registrarError('Solicitud de centro guardada pero falta el correo administrativo (CENTROS_ADMIN_EMAIL o FEEDBACK_ADMIN_EMAIL).')
    } else {
      const { asunto, texto } = construirCorreo(valores, data.id)
      let fallo = null
      try {
        const r = await enviarCorreo({ para: correoAdmin, respuestaA: valores.email, asunto, texto })
        fallo = r?.error || null
      } catch (e) {
        fallo = e
      }
      if (!fallo) {
        await admin.from('solicitudes_centros').update({ aviso_enviado_at: new Date().toISOString() }).eq('id', data.id)
      } else {
        registrarError('No se pudo enviar el aviso de solicitud de centro (queda guardada):', String(fallo?.message || fallo))
        const { data: fila } = await admin.from('solicitudes_centros').select('aviso_intentos').eq('id', data.id).maybeSingle()
        await admin.from('solicitudes_centros').update({ aviso_intentos: (fila?.aviso_intentos || 0) + 1 }).eq('id', data.id)
      }
    }
  }

  return { estado: 200, json: { ok: true } }
}
