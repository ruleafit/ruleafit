import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { MOTIVO_NIF_DUPLICADO, evaluarPerfilFiscal } from '../../../../lib/pagos/evaluarPerfilFiscal.ts'

// Versiones de los textos que el entrenador acepta. Son borradores hasta que el
// asesor revise los documentos (legal/borradores); cuando cambien, se sube la versión.
const VERSION_TERMINOS = 'borrador-2026-10'
const VERSION_AUTOFACTURA = 'borrador-2026-10'

function error(mensaje, status = 400) {
  return NextResponse.json({ error: mensaje }, { status })
}

// Datos que no superan la evaluación: NO se guarda nada (si había un perfil aprobado, sigue como estaba) y se
// devuelven los motivos para corregirlos y reenviar.
function rechazado(motivos) {
  return NextResponse.json({ estado: 'rechazado', motivos, error: motivos.join(' ') }, { status: 422 })
}

// Guarda los datos fiscales del entrenador (los necesita Ruleafit para emitir
// las autofacturas y pagarle). El navegador no escribe en la tabla: este
// servidor los evalúa (lib/pagos/evaluarPerfilFiscal.ts) y, si cumplen, llama a
// guardar_perfil_fiscal() con la clave de servicio, que cifra el IBAN y los deja
// aprobados al instante (sql/101). No hay revisión manual previa.
export async function POST(request) {
  // Mientras los pagos estén apagados no se guardan datos fiscales ni IBAN.
  if (process.env.PAGOS_ACTIVOS !== 'true') {
    return error('Los pagos online no están activados todavía.', 503)
  }

  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) return error('Debes iniciar sesión.', 401)

  const { data: sesion, error: errorSesion } = await supabaseAdmin.auth.getUser(token)
  const usuario = sesion?.user
  if (errorSesion || !usuario) return error('Sesión no válida.', 401)

  let d
  try {
    d = await request.json()
  } catch {
    return error('Cuerpo no válido')
  }

  const { data: actual, error: errorActual } = await supabaseAdmin
    .from('perfiles_fiscales')
    .select('estado, iban_ultimos4')
    .eq('usuario_id', usuario.id)
    .maybeSingle()
  if (errorActual) return error('No se han podido guardar los datos.', 500)
  if (actual?.estado === 'bloqueado') return error('Tus datos fiscales están bloqueados. Escríbenos desde Ayuda.', 403)

  const evaluacion = evaluarPerfilFiscal(d, { hayIbanGuardado: !!actual?.iban_ultimos4 })
  if (!evaluacion.aprobado) return rechazado(evaluacion.motivos)
  const p = evaluacion.perfil

  // El mismo documento no puede estar en otra cuenta (la base de datos lo impide además con una restricción única).
  const { data: otros, error: errorDuplicado } = await supabaseAdmin
    .from('perfiles_fiscales')
    .select('usuario_id')
    .eq('nif', p.nif)
    .neq('usuario_id', usuario.id)
    .limit(1)
  if (errorDuplicado) return error('No se han podido comprobar los datos. Inténtalo de nuevo.', 500)
  if (otros.length > 0) return rechazado([MOTIVO_NIF_DUPLICADO])

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null

  const { data, error: errorRpc } = await supabaseAdmin.rpc('guardar_perfil_fiscal', {
    p_usuario_id: usuario.id,
    p_tipo: p.tipo,
    p_nombre_fiscal: p.nombreFiscal,
    p_tipo_documento: p.tipoDocumento,
    p_nif: p.nif,
    p_direccion: p.direccion,
    p_codigo_postal: p.codigoPostal,
    p_municipio: p.municipio,
    p_provincia: p.provincia,
    p_zona_fiscal: p.zonaFiscal,
    p_email_facturas: p.email,
    p_titular_iban: p.titularIban,
    p_iban: p.iban,
    p_fecha_nacimiento: p.fechaNacimiento,
    p_retencion_reducida: p.retencionReducida,
    p_acepta_terminos_version: VERSION_TERMINOS,
    p_acepta_autofactura_version: VERSION_AUTOFACTURA,
    p_declara_ingresos: true,
    p_responsable_datos: true,
    p_ip: ip,
  })

  if (errorRpc) {
    // P0001: motivo escrito para la persona (p. ej. documento registrado a la vez en otra cuenta).
    if (errorRpc.code === 'P0001') return rechazado([errorRpc.message])
    console.error('guardar_perfil_fiscal falló:', errorRpc.code)
    return error('No se han podido guardar los datos.', 500)
  }

  return NextResponse.json({ ok: true, estado: data?.estado, ibanUltimos4: data?.iban_ultimos4 })
}
