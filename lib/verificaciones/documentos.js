// Comprobaciones de números y nombres de documentos españoles. Sin dependencias.

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

export function normalizar(numero) {
  return String(numero || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
}

// DNI (8 cifras y letra) o NIE (X/Y/Z, 7 cifras y letra) con la letra correcta.
export function dniNieValido(numero) {
  const n = normalizar(numero)
  if (!/^(\d{8}|[XYZ]\d{7})[A-Z]$/.test(n)) return false
  const cifras = n.slice(0, 8).replace(/^[XYZ]/, (l) => 'XYZ'.indexOf(l))
  return LETRAS_DNI[Number(cifras) % 23] === n[8]
}

// CIF de una entidad, con su carácter de control.
export function cifValido(cif) {
  const n = normalizar(cif)
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(n)) return false
  let suma = 0
  for (let i = 1; i <= 7; i++) {
    const d = Number(n[i])
    if (i % 2 === 0) suma += d
    else suma += Math.floor((d * 2) / 10) + ((d * 2) % 10)
  }
  const control = (10 - (suma % 10)) % 10
  const letra = 'JABCDEFGHI'[control]
  if ('PQRSNW'.includes(n[0])) return n[8] === letra
  if ('ABEH'.includes(n[0])) return n[8] === String(control)
  return n[8] === letra || n[8] === String(control)
}

// Mayúsculas sin tildes ni signos, separado en palabras (Ñ pasa a N, como en los documentos).
export function palabras(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
}

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'I'])

export function palabrasDeNombre(nombre) {
  return palabras(nombre).filter((p) => !PARTICULAS.has(p))
}
