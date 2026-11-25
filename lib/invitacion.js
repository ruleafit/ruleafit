// C25 · Invitación pendiente de un visitante que abrió /invita/<código>.
//
// - Al abrir el enlace, el SERVIDOR emite un «billete» de un solo uso (abrir_invitacion) que recuerda cuándo se abrió.
//   Es lo único que se guarda aquí (en localStorage, caduca a los 30 días) y lo que viaja con el registro. Solo recibe
//   recompensa una cuenta creada DESPUÉS de abrir el enlace: una cuenta anterior no puede reclamar nada.
// - Va en una clave APARTE de lib/retorno.js: la invitación y la ruta de retorno (C03: reservar, C15: avisar, seguir…)
//   conviven y ninguna puede pisar a la otra.
// - El navegador NUNCA decide recompensas: solo aporta un billete que el servidor valida (reclamar_invitacion / alta).
// - Abrir un perfil (/entrenador/<usuario>) NO guarda nada aquí: solo /invita/<código> puede atribuir un registro.

const CLAVE = 'ruleafit_invitacion'
export const CADUCIDAD_INVITACION_MS = 30 * 24 * 60 * 60 * 1000
const FORMATO_CODIGO = /^[A-Z0-9]{8}$/
const FORMATO_BILLETE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Código del enlace (/invita/<código>): 8 caracteres A-Z0-9.
export function codigoInvitacionValido(codigo) {
  return typeof codigo === 'string' && FORMATO_CODIGO.test(codigo.trim().toUpperCase())
}

// Billete emitido por el servidor (UUID).
export function billeteValido(billete) {
  return typeof billete === 'string' && FORMATO_BILLETE.test(billete.trim())
}

function almacen() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function guardarInvitacion(billete, ahora = Date.now()) {
  const a = almacen()
  if (!billeteValido(billete) || !a) return false
  try {
    a.setItem(CLAVE, JSON.stringify({ billete: billete.trim().toLowerCase(), ts: ahora }))
    return true
  } catch {
    return false
  }
}

// Devuelve el billete vigente o null (siempre revalida: el almacén es manipulable).
export function leerInvitacion(ahora = Date.now()) {
  const a = almacen()
  if (!a) return null
  try {
    const bruto = a.getItem(CLAVE)
    if (!bruto) return null
    const d = JSON.parse(bruto)
    if (!billeteValido(d?.billete) || typeof d.ts !== 'number' || ahora - d.ts > CADUCIDAD_INVITACION_MS || d.ts > ahora + 60000) {
      a.removeItem(CLAVE)
      return null
    }
    return d.billete
  } catch {
    return null
  }
}

export function borrarInvitacion() {
  try {
    almacen()?.removeItem(CLAVE)
  } catch {
    // sin almacenamiento: nada que borrar
  }
}

// Tras iniciar sesión por primera vez (Google, o confirmación de correo): si hay una invitación pendiente, la reclama.
// La concesión (20 Rulos extra para cada parte) la hace el servidor, una sola vez; aquí se descarta el billete cuando el
// servidor ya ha respondido (concedida o no). Un error de red lo conserva para reintentar en el siguiente inicio.
// Devuelve el estado del servidor o null.
export async function reclamarInvitacionPendiente(supabase) {
  const billete = leerInvitacion()
  if (!billete) return null
  let estado = null
  try {
    const { data } = await supabase.rpc('reclamar_invitacion', { p_ticket: billete })
    estado = data?.estado ?? null
  } catch {
    estado = null
  }
  if (estado !== null) borrarInvitacion()
  return estado
}
