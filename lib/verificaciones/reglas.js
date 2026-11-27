// Reglas compartidas de las verificaciones de perfil (sql/110). Sin dependencias:
// se usa en el navegador, en el servidor y en las pruebas. Los límites deben
// coincidir con los del SQL y los de los buckets.

export const BUCKET_IDENTIDAD = 'verificaciones-identidad'
export const BUCKET_TITULACIONES = 'titulaciones'

export const VERSION_CONSENTIMIENTO = '2026-11-v1'
export const MAX_BYTES = 8 * 1024 * 1024
export const MAX_TITULACIONES = 10
export const ANIO_MINIMO = 1950

export const TIPOS_DOCUMENTO = [
  { valor: 'DNI', nombre: 'DNI' },
  { valor: 'NIE', nombre: 'NIE' },
  { valor: 'PASAPORTE', nombre: 'Pasaporte' },
]

export const EXTENSION_POR_TIPO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export const ACEPTA_ARCHIVOS = Object.keys(EXTENSION_POR_TIPO).join(',')

export const AVISO_TAPAR_DNI =
  'Antes de subir el diploma, tapa tu número de DNI/NIE, tu fecha de nacimiento y tu firma. Otros usuarios podrán ver el documento.'

export const AVISO_LEGAL_TITULACIONES =
  'Documentación aportada por el propio profesional. RuleaFit la ha revisado visualmente, pero no certifica su autenticidad ante la entidad emisora ni garantiza la habilitación profesional. Uso exclusivo para verificación profesional: prohibido copiarla, guardarla o difundirla.'

export const ESTADOS = {
  pendiente: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  revocada: 'Retirada por RuleaFit',
}

export function validarArchivo(archivo) {
  if (!archivo) return 'Adjunta el archivo.'
  if (!EXTENSION_POR_TIPO[archivo.type]) return 'Formato no admitido. Usa JPG, PNG, WEBP o PDF.'
  if (archivo.size <= 0) return 'El archivo está vacío.'
  if (archivo.size > MAX_BYTES) return 'El archivo no puede superar los 8 MB.'
  return ''
}

// Ruta dentro del bucket: <usuario>/<uuid>.<ext> (la exige sql/110).
export function rutaArchivo(usuarioId, tipoMime, uuid) {
  return `${usuarioId}/${uuid}.${EXTENSION_POR_TIPO[tipoMime]}`
}

export function validarTitulacion({ nombre, entidad, anio }, anioActual = new Date().getFullYear()) {
  const n = String(nombre || '').trim()
  const e = String(entidad || '').trim()
  const a = Number(anio)
  if (n.length < 3 || n.length > 150) return 'Escribe el nombre del título (de 3 a 150 caracteres).'
  if (e.length < 2 || e.length > 150) return 'Escribe la entidad emisora (de 2 a 150 caracteres).'
  if (!Number.isInteger(a) || a < ANIO_MINIMO || a > anioActual) return 'El año no es válido.'
  return ''
}

export function normalizarDocumento(numero) {
  return String(numero || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

// Coherencia entre el número del documento revisado y el NIF fiscal. El número
// que escribe el administrador no se guarda: solo el resultado.
export function compararDocumento(numero, nifFiscal) {
  if (!nifFiscal) return 'sin_perfil_fiscal'
  return normalizarDocumento(numero) === normalizarDocumento(nifFiscal) ? 'coincide' : 'no_coincide'
}

export function textoMarcaDeAgua({ username, email, fecha = new Date() }) {
  const cuando = fecha.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const quien = [username ? `@${username}` : '', email || ''].filter(Boolean).join(' · ') || 'Usuario'
  return [quien, cuando, 'Uso exclusivo para verificación profesional']
}
