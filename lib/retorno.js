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

// Qué quería hacer el visitante al volver a la sesión: reservarla o activar un aviso de plaza (C15). Son intenciones
// distintas y no se confunden: se guarda la última acción explícita y se valida contra esta lista.
// C25: en el perfil público de un rulero las intenciones son «seguir» o «favorito» (dos acciones distintas e
// independientes). Cada ruta solo admite sus propias intenciones.
export const INTENCIONES = ['reservar', 'avisar', 'seguir', 'favorito']
const INTENCIONES_SESION = ['reservar', 'avisar']
const INTENCIONES_PERFIL = ['seguir', 'favorito']
function intencionSegura(i, ruta) {
  if (typeof ruta === 'string' && ruta.startsWith('/entrenador/')) return INTENCIONES_PERFIL.includes(i) ? i : 'seguir'
  return INTENCIONES_SESION.includes(i) ? i : 'reservar'
}

const RUTA_SESION = /^\/clases\/[A-Za-z0-9-]{8,64}$/
// Perfil público de un rulero: mismo formato que el nombre de usuario (3-20 letras, números y guion bajo).
const RUTA_PERFIL = /^\/entrenador\/[A-Za-z0-9_]{3,20}$/

export function rutaSegura(ruta) {
  if (typeof ruta !== 'string' || ruta.length > 120) return null
  if (!RUTA_SESION.test(ruta) && !RUTA_PERFIL.test(ruta)) return null // también descarta '//', '\\', '?', '#', esquemas y dominios
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

export function guardarRetorno({ ruta, titulo = '', intencion = 'reservar' }, ahora = Date.now()) {
  const limpia = rutaSegura(ruta)
  const a = almacen()
  if (!limpia || !a) return false
  try {
    a.setItem(CLAVE, JSON.stringify({ ruta: limpia, titulo: limpiarTitulo(titulo), intencion: intencionSegura(intencion, limpia), ts: ahora }))
    return true
  } catch {
    return false
  }
}

// Devuelve { ruta, titulo, intencion } válido y vigente, o null. Siempre revalida (el almacén es manipulable).
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
    return { ruta, titulo: limpiarTitulo(d.titulo), intencion: intencionSegura(d.intencion, ruta) }
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
  const mismaSesion = previo?.ruta === ruta
  const parametro = new URLSearchParams(busqueda).get('intencion')
  guardarRetorno({
    ruta,
    titulo: mismaSesion ? previo.titulo : '',
    // Sin parámetro explícito se conserva la intención ya guardada para esa misma sesión (no se pisa una por otra).
    intencion: INTENCIONES.includes(parametro) ? parametro : mismaSesion ? previo.intencion : undefined,
  })
  return leerRetorno()
}

// Destino tras autenticarse: la sesión pendiente o la portada.
export function destinoTrasLogin() {
  return leerRetorno()?.ruta || '/'
}
