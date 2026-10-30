import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import {
  coincideProvinciaConCodigoPostal,
  validarCodigoPostal,
  validarEmail,
  validarIBAN,
  validarNIF,
  zonaFiscalDeCodigoPostal,
} from '../../../../lib/pagos/validaciones.ts'

// Versiones de los textos que el entrenador acepta. Son borradores hasta que el
// asesor revise los documentos (legal/borradores); cuando cambien, se sube la versión.
const VERSION_TERMINOS = 'borrador-2026-10'
const VERSION_AUTOFACTURA = 'borrador-2026-10'

const TIPOS = ['persona_fisica_profesional', 'persona_fisica_empresarial', 'sociedad']

const texto = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max

function error(mensaje) {
  return NextResponse.json({ error: mensaje }, { status: 400 })
}

// Guarda los datos fiscales del entrenador (los necesita Ruleafit para emitir
// las autofacturas y pagarle). El navegador no escribe en la tabla: este
// servidor valida los datos y llama a guardar_perfil_fiscal() con la clave de
// servicio, que cifra el IBAN.
export async function POST(request) {
  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

  const { data: sesion, error: errorSesion } = await supabaseAdmin.auth.getUser(token)
  const usuario = sesion?.user
  if (errorSesion || !usuario) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

  let d
  try {
    d = await request.json()
  } catch {
    return error('Cuerpo no válido')
  }

  if (!TIPOS.includes(d.tipo)) return error('Elige el tipo de titular.')
  if (!texto(d.nombreFiscal, 2, 200)) return error('Escribe el nombre o razón social fiscal.')
  if (!texto(d.direccion, 3, 250)) return error('Escribe tu dirección fiscal.')
  if (!texto(d.municipio, 2, 120)) return error('Escribe el municipio.')
  if (!texto(d.provincia, 2, 80)) return error('Escribe la provincia.')
  if (!texto(d.titularIban, 2, 200)) return error('Escribe el titular de la cuenta.')
  if (typeof d.codigoPostal !== 'string' || !validarCodigoPostal(d.codigoPostal)) {
    return error('El código postal no es válido.')
  }
  if (!coincideProvinciaConCodigoPostal(d.codigoPostal, d.provincia)) {
    return error('La provincia no coincide con el código postal.')
  }
  if (typeof d.email !== 'string' || !validarEmail(d.email)) {
    return error('El correo para las facturas no es válido.')
  }

  const tipoDocumento = typeof d.nif === 'string' ? validarNIF(d.nif) : null
  if (!tipoDocumento) return error('El NIF/NIE/CIF no es válido. Revisa los dígitos y la letra.')
  const esSociedad = d.tipo === 'sociedad'
  if (esSociedad && tipoDocumento !== 'CIF') return error('Una sociedad debe indicar su CIF.')
  if (!esSociedad && tipoDocumento === 'CIF') return error('Una persona física debe indicar su DNI o NIE.')

  let fechaNacimiento = null
  if (!esSociedad) {
    const nacimiento = typeof d.fechaNacimiento === 'string' ? new Date(d.fechaNacimiento) : null
    if (!nacimiento || Number.isNaN(nacimiento.getTime())) return error('Indica tu fecha de nacimiento.')
    const hoy = new Date()
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) edad -= 1
    if (edad < 18 || edad > 110) return error('La fecha de nacimiento no es válida (debes ser mayor de edad).')
    fechaNacimiento = d.fechaNacimiento
  }

  const hayIban = typeof d.iban === 'string' && d.iban.trim() !== ''
  if (hayIban && !validarIBAN(d.iban)) return error('El IBAN no es válido (debe ser una cuenta española).')

  if (d.declaraIngresos !== true || d.responsableDatos !== true || d.aceptaAutofactura !== true) {
    return error('Debes marcar todas las casillas de declaración y aceptación.')
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null

  const { data, error: errorRpc } = await supabaseAdmin.rpc('guardar_perfil_fiscal', {
    p_usuario_id: usuario.id,
    p_tipo: d.tipo,
    p_nombre_fiscal: d.nombreFiscal,
    p_tipo_documento: tipoDocumento,
    p_nif: d.nif.replace(/[\s.-]/g, ''),
    p_direccion: d.direccion,
    p_codigo_postal: d.codigoPostal,
    p_municipio: d.municipio,
    p_provincia: d.provincia,
    p_zona_fiscal: zonaFiscalDeCodigoPostal(d.codigoPostal),
    p_email_facturas: d.email,
    p_titular_iban: d.titularIban,
    p_iban: hayIban ? d.iban : null,
    p_fecha_nacimiento: fechaNacimiento,
    p_retencion_reducida: d.retencionReducida === true,
    p_acepta_terminos_version: VERSION_TERMINOS,
    p_acepta_autofactura_version: VERSION_AUTOFACTURA,
    p_declara_ingresos: true,
    p_responsable_datos: true,
    p_ip: ip,
  })

  if (errorRpc) {
    if (errorRpc.code === 'P0001') return error(errorRpc.message)
    console.error('guardar_perfil_fiscal falló:', errorRpc.code)
    return NextResponse.json({ error: 'No se han podido guardar los datos.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, estado: data?.estado, ibanUltimos4: data?.iban_ultimos4 })
}
