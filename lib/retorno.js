// C03 · Reserva exprés: recordar a qué sesión quería apuntarse un visitante mientras se registra o inicia sesión.
//
// - Solo se guarda una RUTA INTERNA (/clases/<id>) y el título de la sesión para mostrarlo: nunca credenciales,
//   tokens ni datos personales. Vive en localStorage (sobrevive al viaje a Google y al enlace de confirmación de
//   correo, que puede abrirse en otra pestaña) y caduca a las 6 horas.
// - Lista blanca estricta: solo /clases/<id>. Nada de URLs externas, '//', '\', parámetros ni almacenes de otras
//   rutas (así tampoco puede haber bucles con /login o /registro).
// - C25 (invitar amigos), cuando exista: el campo `invitacion` queda reservado en el mismo registro. Aquí NO se
//   acepta ni se valida ningún identificador: guardarRetorno() lo ignora hasta que C25 defina cómo comprobarlo
//   en el servidor.

const CLAVE = 'ruleafit_retorno'
export const CADUCIDAD_MS = 6 * 60 * 60 * 1000

const RUTA_SESION = /^\/clases\/[A-Za-z0-9-]{8,64}$/

export function rutaSegura(ruta) {
  if (typeof ruta !== 'string' || ruta.length > 120) return null
  if (!RUTA_SESION.test(ruta)) return null // también descarta '//', '\\', '?', '#', esquemas y dominios
  return ruta
}

function limpiarTitulo(t) {
  if (typeof t !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return t.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100)
}

function almacen() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function guardarRetorno({ ruta, titulo = '' }, ahora = Date.now()) {
  const limpia = rutaSegura(ruta)
  const a = almacen()
  if (!limpia || !a) return false
  try {
    a.setItem(CLAVE, JSON.stringify({ ruta: limpia, titulo: limpiarTitulo(titulo), ts: ahora }))
    return true
  } catch {
    return false
  }
}

// Devuelve { ruta, titulo } válido y vigente, o null. Siempre revalida (el almacén es manipulable).
export function leerRetorno(ahora = Date.now()) {
  const a = almacen()
  if (!a) return null
  try {
    const bruto = a.getItem(CLAVE)
    if (!bruto) return null
    const d = JSON.parse(bruto)
    const ruta = rutaSegura(d?.ruta)
    if (!ruta || typeof d.ts !== 'number' || ahora - d.ts > CADUCIDAD_MS || d.ts > ahora + 60000) {
      a.removeItem(CLAVE)
      return null
    }
    return { ruta, titulo: limpiarTitulo(d.titulo) }
  } catch {
    return null
  }
}

export function borrarRetorno() {
  try {
    almacen()?.removeItem(CLAVE)
  } catch {
    // sin almacenamiento: nada que borrar
  }
}

// Si la URL actual trae ?volver=/clases/<id> válido (p. ej. desde el panel de reserva), lo guarda conservando el
// título ya guardado para esa misma sesión. Un valor no válido se ignora sin más.
export function ingerirVolverDeUrl(busqueda = typeof window !== 'undefined' ? window.location.search : '') {
  const ruta = rutaSegura(new URLSearchParams(busqueda).get('volver'))
  if (!ruta) return null
  const previo = leerRetorno()
  guardarRetorno({ ruta, titulo: previo?.ruta === ruta ? previo.titulo : '' })
  return leerRetorno()
}

// Destino tras autenticarse: la sesión pendiente o la portada.
export function destinoTrasLogin() {
  return leerRetorno()?.ruta || '/'
}
