// Zona de lectura mecánica (MRZ) de documentos de identidad: formato TD1 (DNI y
// tarjeta de extranjero, 3 líneas de 30) y TD3 (pasaporte, 2 líneas de 44).
// Solo se da por leída si TODOS los dígitos de control cuadran.

const A_CIFRA = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8' }
const A_LETRA = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B' }

const cifras = (t) => t.replace(/[A-Z]/g, (c) => A_CIFRA[c] ?? c)
const letras = (t) => t.replace(/\d/g, (c) => A_LETRA[c] ?? c)

function letraDni(numero) {
  const c = numero.slice(0, 8).replace(/^[XYZ]/, (l) => 'XYZ'.indexOf(l))
  return /^\d{8}$/.test(c) ? 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(c) % 23] : ''
}

export function digitoControl(texto) {
  const pesos = [7, 3, 1]
  let suma = 0
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    const v = c === '<' ? 0 : c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 55
    suma += v * pesos[i % 3]
  }
  return String(suma % 10)
}

const cuadra = (campo, control) => digitoControl(campo) === cifras(control)

function fecha(aammdd, { futura }, hoy) {
  if (!/^\d{6}$/.test(aammdd)) return null
  let anio = 2000 + Number(aammdd.slice(0, 2))
  // Una fecha de nacimiento posterior a hoy es del siglo pasado.
  if (!futura && anio > hoy.getUTCFullYear()) anio -= 100
  const mes = Number(aammdd.slice(2, 4))
  const dia = Number(aammdd.slice(4, 6))
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d : null
}

// Líneas del texto leído que pueden ser de una MRZ.
export function lineasCandidatas(texto) {
  return String(texto || '')
    .toUpperCase()
    .split('\n')
    .map((l) => l.replace(/[«‹]/g, '<').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 26)
}

const ajusta = (linea, largo) => (linea + '<'.repeat(largo)).slice(0, largo)

function nombreDe(linea) {
  return letras(linea).replace(/<+/g, ' ').trim()
}

function td1(l1, l2, l3, hoy) {
  const a = ajusta(l1, 30)
  const b = ajusta(l2, 30)
  if (!/^[IAC]/.test(a)) return null
  const numeroBase = a.slice(5, 14)
  // El número de soporte es 3 letras y 6 cifras en los documentos españoles.
  const soportes = [numeroBase, letras(numeroBase.slice(0, 3)) + cifras(numeroBase.slice(3))]
  const soporte = soportes.find((s) => cuadra(s, a[14]))
  const nacimiento = cifras(b.slice(0, 6))
  const caducidad = cifras(b.slice(8, 14))
  if (!soporte || !cuadra(nacimiento, b[6]) || !cuadra(caducidad, b[14])) return null

  // Número personal (DNI o NIE) en el campo opcional de la primera línea.
  const opcional = a.slice(15, 30)
  const m = opcional.replace(/</g, ' ').trim().split(' ')[0] || ''
  const personal = /^[XYZ]/.test(m)
    ? m[0] + cifras(m.slice(1, 8)) + letras(m.slice(8, 9))
    : cifras(m.slice(0, 8)) + letras(m.slice(8, 9))

  const compuesto = (s) =>
    s + a[14] + opcional + nacimiento + cifras(b[6]) + caducidad + cifras(b[14]) + b.slice(18, 29)
  // En los documentos españoles tras el número solo hay relleno (<), que el
  // lector confunde a menudo; si la letra se leyó mal se prueba la que
  // corresponde a las cifras. Manda siempre el dígito de control compuesto.
  const control = (numero) =>
    soporte + a[14] + ajusta(numero, 15) + nacimiento + cifras(b[6]) + caducidad + cifras(b[14]) + '<'.repeat(11)
  let leido = null
  if (cuadra(compuesto(soporte), b[29])) leido = personal
  else leido = [personal, personal.slice(0, 8) + letraDni(personal)].find((n) => cuadra(control(n), b[29])) ?? null
  if (leido === null) return null

  return {
    formato: 'TD1',
    numero: soporte.replace(/</g, ''),
    personal: leido,
    nacimiento: fecha(nacimiento, { futura: false }, hoy),
    caducidad: fecha(caducidad, { futura: true }, hoy),
    nombre: nombreDe(l3 || ''),
  }
}

function td3(l1, l2, hoy) {
  const a = ajusta(l1, 44)
  const b = ajusta(l2, 44)
  if (a[0] !== 'P') return null
  const numero = b.slice(0, 9)
  const variantes = [numero, letras(numero.slice(0, 3)) + cifras(numero.slice(3))]
  const bueno = variantes.find((v) => cuadra(v, b[9]))
  const nacimiento = cifras(b.slice(13, 19))
  const caducidad = cifras(b.slice(21, 27))
  if (!bueno || !cuadra(nacimiento, b[19]) || !cuadra(caducidad, b[27])) return null
  const opcional = b.slice(28, 42)
  const compuesto = bueno + cifras(b[9]) + nacimiento + cifras(b[19]) + caducidad + cifras(b[27]) + opcional + b[42]
  if (!cuadra(compuesto, b[43])) return null
  // Los pasaportes españoles llevan el DNI en el campo opcional.
  const dni = opcional.replace(/</g, '').match(/[0-9XYZ][0-9OIZSB]{7}[A-Z]/)
  return {
    formato: 'TD3',
    numero: bueno.replace(/</g, ''),
    personal: dni ? (/^[XYZ]/.test(dni[0]) ? dni[0][0] : cifras(dni[0][0])) + cifras(dni[0].slice(1, 8)) + dni[0][8] : '',
    nacimiento: fecha(nacimiento, { futura: false }, hoy),
    caducidad: fecha(caducidad, { futura: true }, hoy),
    nombre: nombreDe(a.slice(5)),
  }
}

// Busca una MRZ válida en el texto leído. Devuelve null si no hay ninguna fiable.
export function leerMrz(texto, hoy = new Date()) {
  const lineas = lineasCandidatas(texto)
  for (let i = 0; i < lineas.length - 1; i++) {
    const resultado = td3(lineas[i], lineas[i + 1], hoy) || td1(lineas[i], lineas[i + 1], lineas[i + 2], hoy)
    if (resultado?.nacimiento && resultado.caducidad && resultado.nombre) return resultado
  }
  return null
}
