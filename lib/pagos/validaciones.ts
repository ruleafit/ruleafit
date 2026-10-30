// Validaciones de los datos fiscales del entrenador. Solo comprueban el FORMATO
// y los dígitos o letras de control: no pueden demostrar que el documento exista
// ni que sea de esa persona (eso es responsabilidad de quien lo declara).

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

function limpiar(valor: string): string {
  return valor.replace(/[\s.-]/g, '').toUpperCase()
}

/** DNI: 8 cifras y letra de control. */
export function validarDNI(valor: string): boolean {
  const v = limpiar(valor)
  const m = /^(\d{8})([A-Z])$/.exec(v)
  return !!m && LETRAS_DNI[Number(m[1]) % 23] === m[2]
}

/** NIE: X, Y o Z, 7 cifras y letra de control. */
export function validarNIE(valor: string): boolean {
  const v = limpiar(valor)
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(v)
  if (!m) return false
  const prefijo = 'XYZ'.indexOf(m[1])
  return LETRAS_DNI[Number(`${prefijo}${m[2]}`) % 23] === m[3]
}

/**
 * CIF de sociedades: letra de tipo, 7 cifras y control (cifra o letra según el
 * tipo de entidad).
 */
export function validarCIF(valor: string): boolean {
  const v = limpiar(valor)
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v)
  if (!m) return false
  const [, tipo, cifras, control] = m

  let suma = 0
  for (let i = 0; i < 7; i++) {
    const d = Number(cifras[i])
    if (i % 2 === 0) {
      const doble = d * 2
      suma += Math.floor(doble / 10) + (doble % 10)
    } else {
      suma += d
    }
  }
  const digito = (10 - (suma % 10)) % 10
  const letra = 'JABCDEFGHI'[digito]

  if ('PQRSNW'.includes(tipo)) return control === letra // control siempre letra
  if ('ABEH'.includes(tipo)) return control === String(digito) // control siempre cifra
  return control === String(digito) || control === letra
}

export type TipoDocumento = 'DNI' | 'NIE' | 'CIF'

/** Detecta el tipo de documento válido, o null si no lo es. */
export function validarNIF(valor: string): TipoDocumento | null {
  if (validarDNI(valor)) return 'DNI'
  if (validarNIE(valor)) return 'NIE'
  if (validarCIF(valor)) return 'CIF'
  return null
}

/** IBAN español: ES + 22 cifras con dígitos de control correctos (mod 97). */
export function validarIBAN(valor: string): boolean {
  const iban = valor.replace(/\s/g, '').toUpperCase()
  if (!/^ES\d{22}$/.test(iban)) return false
  const reordenado = iban.slice(4) + iban.slice(0, 4)
  let resto = 0
  for (const caracter of reordenado) {
    const trozo = /[A-Z]/.test(caracter) ? String(caracter.charCodeAt(0) - 55) : caracter
    resto = Number(`${resto}${trozo}`) % 97
  }
  return resto === 1
}

/** Código postal español: 5 cifras con prefijo de provincia entre 01 y 52. */
export function validarCodigoPostal(cp: string): boolean {
  return /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(cp.trim())
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

// Nombres de provincia por prefijo de código postal (01-52), con las variantes
// habituales en castellano y en la lengua de cada territorio.
const PROVINCIAS: Record<string, string[]> = {
  '01': ['Álava', 'Araba'], '02': ['Albacete'], '03': ['Alicante', 'Alacant'], '04': ['Almería'],
  '05': ['Ávila'], '06': ['Badajoz'], '07': ['Illes Balears', 'Islas Baleares', 'Baleares'],
  '08': ['Barcelona'], '09': ['Burgos'], '10': ['Cáceres'], '11': ['Cádiz'],
  '12': ['Castellón', 'Castelló'], '13': ['Ciudad Real'], '14': ['Córdoba'],
  '15': ['A Coruña', 'La Coruña'], '16': ['Cuenca'], '17': ['Girona', 'Gerona'], '18': ['Granada'],
  '19': ['Guadalajara'], '20': ['Gipuzkoa', 'Guipúzcoa'], '21': ['Huelva'], '22': ['Huesca'],
  '23': ['Jaén'], '24': ['León'], '25': ['Lleida', 'Lérida'], '26': ['La Rioja', 'Rioja'],
  '27': ['Lugo'], '28': ['Madrid', 'Comunidad de Madrid'], '29': ['Málaga'],
  '30': ['Murcia', 'Región de Murcia'], '31': ['Navarra', 'Nafarroa'], '32': ['Ourense', 'Orense'],
  '33': ['Asturias', 'Principado de Asturias'], '34': ['Palencia'], '35': ['Las Palmas'],
  '36': ['Pontevedra'], '37': ['Salamanca'], '38': ['Santa Cruz de Tenerife'],
  '39': ['Cantabria'], '40': ['Segovia'], '41': ['Sevilla'], '42': ['Soria'], '43': ['Tarragona'],
  '44': ['Teruel'], '45': ['Toledo'], '46': ['Valencia', 'València'], '47': ['Valladolid'],
  '48': ['Bizkaia', 'Vizcaya'], '49': ['Zamora'], '50': ['Zaragoza'], '51': ['Ceuta'], '52': ['Melilla'],
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** ¿La provincia escrita corresponde al código postal? (sin tildes ni mayúsculas) */
export function coincideProvinciaConCodigoPostal(cp: string, provincia: string): boolean {
  if (!validarCodigoPostal(cp)) return false
  const nombres = PROVINCIAS[cp.trim().slice(0, 2)] || []
  const buscada = normalizar(provincia)
  return nombres.some((n) => normalizar(n) === buscada)
}

export type ZonaFiscal = 'peninsula_baleares' | 'navarra_pais_vasco' | 'canarias' | 'ceuta_melilla'

/**
 * Zona fiscal que corresponde a un código postal. Importante: Canarias, Ceuta y
 * Melilla no aplican el IVA (IGIC / IPSI) y Navarra y País Vasco tienen Hacienda
 * foral; esas zonas se revisan a mano (ver docs/plan-pagos-fase-1.md).
 */
export function zonaFiscalDeCodigoPostal(cp: string): ZonaFiscal | null {
  if (!validarCodigoPostal(cp)) return null
  const prefijo = cp.trim().slice(0, 2)
  if (prefijo === '35' || prefijo === '38') return 'canarias'
  if (prefijo === '51' || prefijo === '52') return 'ceuta_melilla'
  if (['01', '20', '31', '48'].includes(prefijo)) return 'navarra_pais_vasco'
  return 'peninsula_baleares'
}
