// Evaluación AUTOMÁTICA de los datos fiscales y bancarios al guardarlos (la ejecuta el servidor).
// Si todo cumple, el perfil queda aprobado (estado 'activo', sql/101); si no, se rechaza con los motivos y no se
// guarda nada. Comprueba formato y dígitos de control: NO demuestra que el documento o la cuenta sean de esa persona.
// La duplicidad del documento en otra cuenta se comprueba aparte (consulta + restricción única en la base de datos).
import {
  coincideProvinciaConCodigoPostal,
  validarCodigoPostal,
  validarEmail,
  validarIBAN,
  validarNIF,
  zonaFiscalDeCodigoPostal,
  type TipoDocumento,
  type ZonaFiscal,
} from './validaciones.ts'

export const TIPOS_TITULAR = ['persona_fisica_profesional', 'persona_fisica_empresarial', 'sociedad'] as const

export const MOTIVO_NIF_DUPLICADO = 'Ese NIF/NIE/CIF ya está registrado en otra cuenta.'

export type PerfilEvaluado = {
  tipo: string
  nombreFiscal: string
  tipoDocumento: TipoDocumento
  nif: string
  direccion: string
  codigoPostal: string
  municipio: string
  provincia: string
  zonaFiscal: ZonaFiscal
  email: string
  titularIban: string
  /** null = conservar el IBAN ya guardado. */
  iban: string | null
  fechaNacimiento: string | null
  retencionReducida: boolean
}

export type Evaluacion = { aprobado: true; perfil: PerfilEvaluado } | { aprobado: false; motivos: string[] }

const limpio = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
const entre = (v: string, min: number, max: number) => v.length >= min && v.length <= max
const palabras = (v: string) => v.split(' ').filter((p) => /\p{L}/u.test(p)).length

/** Motivo por el que un IBAN no vale, o null si es correcto (cuenta española, ISO 7064 módulo 97-10). */
export function motivoIban(valor: string): string | null {
  const iban = valor.replace(/\s/g, '').toUpperCase()
  if (!iban.startsWith('ES')) return 'El IBAN debe ser de una cuenta española (empieza por ES).'
  if (iban.length !== 24) return `El IBAN español tiene 24 caracteres y has escrito ${iban.length}.`
  if (!/^ES\d{22}$/.test(iban)) return 'El IBAN solo puede llevar cifras después de ES.'
  return validarIBAN(iban) ? null : 'El IBAN no es correcto: los dígitos de control no cuadran.'
}

function motivoNombre(valor: string, esSociedad: boolean, campo: string): string | null {
  if (!entre(valor, 2, 200) || palabras(valor) === 0) return `Escribe ${campo}.`
  if (!esSociedad && palabras(valor) < 2) return `En ${campo} faltan los apellidos (nombre y al menos un apellido).`
  return null
}

function edadEn(nacimiento: Date, hoy: Date): number {
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear()
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth()
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) edad -= 1
  return edad
}

export function evaluarPerfilFiscal(
  entrada: unknown,
  opciones: { hayIbanGuardado?: boolean; hoy?: Date } = {}
): Evaluacion {
  const d = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const motivos: string[] = []
  const fallo = (m: string | null) => {
    if (m) motivos.push(m)
  }

  const tipo = limpio(d.tipo)
  const tipoValido = (TIPOS_TITULAR as readonly string[]).includes(tipo)
  if (!tipoValido) motivos.push('Elige el tipo de titular.')
  const esSociedad = tipo === 'sociedad'

  const nombreFiscal = limpio(d.nombreFiscal)
  fallo(motivoNombre(nombreFiscal, esSociedad, esSociedad ? 'la razón social' : 'el nombre y apellidos'))

  const nif = limpio(d.nif).replace(/[\s.-]/g, '').toUpperCase()
  const tipoDocumento = validarNIF(nif)
  if (!tipoDocumento) {
    motivos.push('El NIF/NIE/CIF no es válido: revisa las cifras y la letra o dígito de control.')
  } else if (tipoValido && esSociedad !== (tipoDocumento === 'CIF')) {
    motivos.push(esSociedad ? 'Una sociedad debe indicar su CIF.' : 'Una persona física debe indicar su DNI o NIE.')
  }

  const direccion = limpio(d.direccion)
  if (!entre(direccion, 3, 250)) motivos.push('Escribe tu dirección fiscal.')
  const municipio = limpio(d.municipio)
  if (!entre(municipio, 2, 120)) motivos.push('Escribe el municipio.')
  const provincia = limpio(d.provincia)
  const codigoPostal = limpio(d.codigoPostal)
  if (!validarCodigoPostal(codigoPostal)) {
    motivos.push('El código postal debe tener 5 cifras, entre 01xxx y 52xxx.')
  } else if (!entre(provincia, 2, 80) || !coincideProvinciaConCodigoPostal(codigoPostal, provincia)) {
    motivos.push('La provincia no coincide con el código postal.')
  }
  if (!entre(provincia, 2, 80) && !validarCodigoPostal(codigoPostal)) motivos.push('Escribe la provincia.')

  const email = limpio(d.email)
  if (!validarEmail(email)) motivos.push('El correo para las facturas no es válido.')

  const titularIban = limpio(d.titularIban)
  fallo(motivoNombre(titularIban, esSociedad, 'el titular de la cuenta'))

  const ibanEscrito = limpio(d.iban)
  if (ibanEscrito) fallo(motivoIban(ibanEscrito))
  else if (!opciones.hayIbanGuardado) motivos.push('Escribe el IBAN de tu cuenta.')

  let fechaNacimiento: string | null = null
  if (!esSociedad) {
    const texto = limpio(d.fechaNacimiento)
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T00:00:00Z`) : null
    // La comparación descarta fechas imposibles (31 de febrero), que Date correría al mes siguiente.
    if (!fecha || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
      motivos.push('Indica tu fecha de nacimiento.')
    } else {
      const edad = edadEn(fecha, opciones.hoy ?? new Date())
      if (edad < 18 || edad > 110) motivos.push('La fecha de nacimiento no es válida (debes ser mayor de edad).')
      else fechaNacimiento = texto
    }
  }

  if (d.declaraIngresos !== true || d.responsableDatos !== true || d.aceptaAutofactura !== true) {
    motivos.push('Marca todas las casillas de declaración y aceptación.')
  }

  if (motivos.length || !tipoDocumento) return { aprobado: false, motivos }
  return {
    aprobado: true,
    perfil: {
      tipo,
      nombreFiscal,
      tipoDocumento,
      nif,
      direccion,
      codigoPostal,
      municipio,
      provincia,
      zonaFiscal: zonaFiscalDeCodigoPostal(codigoPostal)!,
      email,
      titularIban,
      iban: ibanEscrito || null,
      fechaNacimiento,
      retencionReducida: d.retencionReducida === true,
    },
  }
}
