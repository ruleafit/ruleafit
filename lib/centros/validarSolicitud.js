// Validación de la solicitud de un centro deportivo (N15). Es la MISMA que se usa en el formulario (para avisar
// a la persona) y en el servidor (que no se fía del navegador). Funciones puras, sin dependencias.

export const TIPOS_SOLICITUD = {
  demostracion: 'Solicitar una demostración',
  informacion: 'Recibir información',
  ayuda: 'Ayuda para empezar',
}

export const LIMITES = { centro: 100, ciudad: 80, contacto: 80, email: 120, telefono: 20, mensaje: 1000 }

// Quita caracteres de control (y saltos de línea si no se permiten) y recorta. El texto se guarda tal cual y
// nunca se interpreta como HTML (la web y el correo lo tratan como texto plano).
export function limpiarTexto(valor, { saltos = false } = {}) {
  let t = String(valor ?? '').replace(/\r\n?/g, '\n')
  t = t.replace(saltos ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, saltos ? '' : ' ')
  t = saltos ? t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ')
  return t.trim()
}

const REGEX_EMAIL = /^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[^\s@<>"',;:()\[\]\\]{2,}$/
const REGEX_TELEFONO = /^\+?[0-9][0-9\s().-]{5,19}$/

// datos = { centro, ciudad, contacto, email, telefono, tipo, mensaje, privacidad }
// Devuelve { errores: { campo: texto }, valores } (valores = ya limpios y listos para guardar).
export function validarSolicitud(datos) {
  const d = datos || {}
  const v = {
    centro: limpiarTexto(d.centro),
    ciudad: limpiarTexto(d.ciudad),
    contacto: limpiarTexto(d.contacto),
    email: limpiarTexto(d.email).toLowerCase(),
    telefono: limpiarTexto(d.telefono),
    tipo: String(d.tipo ?? ''),
    mensaje: limpiarTexto(d.mensaje, { saltos: true }),
    privacidad: d.privacidad === true,
  }
  const e = {}

  if (v.centro.length < 2) e.centro = 'Escribe el nombre del centro.'
  else if (v.centro.length > LIMITES.centro) e.centro = `El nombre del centro puede tener como máximo ${LIMITES.centro} caracteres.`

  if (v.ciudad.length < 2) e.ciudad = 'Escribe la ciudad o municipio.'
  else if (v.ciudad.length > LIMITES.ciudad) e.ciudad = `La ciudad puede tener como máximo ${LIMITES.ciudad} caracteres.`

  if (v.contacto.length < 2) e.contacto = 'Escribe el nombre de la persona de contacto.'
  else if (v.contacto.length > LIMITES.contacto) e.contacto = `El nombre puede tener como máximo ${LIMITES.contacto} caracteres.`

  if (!v.email) e.email = 'Escribe tu correo electrónico.'
  else if (v.email.length > LIMITES.email || !REGEX_EMAIL.test(v.email)) e.email = 'Revisa el correo electrónico: no parece válido.'

  if (v.telefono && !REGEX_TELEFONO.test(v.telefono)) e.telefono = 'Revisa el teléfono (solo números, espacios y el prefijo +).'

  if (!(v.tipo in TIPOS_SOLICITUD)) e.tipo = 'Elige qué necesitas.'

  if (v.mensaje.length > LIMITES.mensaje) e.mensaje = `El mensaje puede tener como máximo ${LIMITES.mensaje} caracteres.`

  if (!v.privacidad) e.privacidad = 'Para enviar la solicitud debes aceptar la política de privacidad.'

  return { errores: e, valores: v }
}
