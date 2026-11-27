import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { usuarioDePeticion, UUID } from '../../../../lib/verificaciones/sesion'
import { BUCKET_IDENTIDAD } from '../../../../lib/verificaciones/reglas'
import { leerIdentidad, leerTexto } from '../../../../lib/verificaciones/leer'
import { decidirIdentidad, decidirCentro, nucleoRazonSocial } from '../../../../lib/verificaciones/decidir'
import { normalizar } from '../../../../lib/verificaciones/documentos'
import { huellaDocumento } from '../../../../lib/verificaciones/huella'
import { avisarAdmin, TABLAS } from '../../../../lib/verificaciones/aviso'
import { purgarArchivos } from '../../../../lib/verificaciones/purga'

export const maxDuration = 60

const PEDIR_REVISION = ' Puedes corregirlo y volver a enviarlo, o pedir revisión manual.'

async function descargar(ruta) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_IDENTIDAD).download(ruta)
  if (error) throw new Error(error.message)
  return Buffer.from(await data.arrayBuffer())
}

async function datosFiscales(usuarioId) {
  const { data, error } = await supabaseAdmin
    .from('perfiles_fiscales')
    .select('tipo, nombre_fiscal, nif')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// Si hay perfil fiscal de persona, manda sobre lo escrito en el formulario.
async function analizarIdentidad(fila, usuarioId, declarado) {
  const fiscal = await datosFiscales(usuarioId)
  const persona = fiscal && fiscal.tipo !== 'sociedad' ? fiscal : null
  const nombre = persona?.nombre_fiscal || String(declarado.nombre || '').slice(0, 200)
  const numero = persona?.nif || String(declarado.numero || '').slice(0, 30)
  const pasaporte = fila.tipo_documento === 'PASAPORTE'

  const [primera, segunda] = await Promise.all([
    descargar(fila.ruta_anverso),
    fila.ruta_reverso ? descargar(fila.ruta_reverso) : null,
  ])
  // La MRZ está en la página de datos del pasaporte y en el reverso del DNI/NIE.
  const textos = await leerIdentidad(
    pasaporte ? { caraMrz: primera } : { caraMrz: segunda, anverso: primera }
  )
  return {
    ...decidirIdentidad({ tipo: fila.tipo_documento, ...textos, nombre, numero }),
    coincideFiscal: persona ? 'coincide' : 'sin_perfil_fiscal',
  }
}

async function analizarCentro(fila, usuarioId) {
  const fiscal = await datosFiscales(usuarioId)
  if (fiscal?.tipo === 'sociedad') {
    if (normalizar(fiscal.nif) !== fila.cif) {
      return { decision: 'rechazar', motivo: 'El CIF no coincide con el de tu perfil fiscal.' }
    }
    if (nucleoRazonSocial(fiscal.nombre_fiscal).join('') !== nucleoRazonSocial(fila.razon_social).join('')) {
      return { decision: 'manual', motivo: 'La razón social no coincide con el perfil fiscal.' }
    }
  }
  const texto = await leerTexto(await descargar(fila.ruta))
  return decidirCentro({ texto, razonSocial: fila.razon_social, cif: fila.cif })
}

// Guarda la decisión automática. Devuelve false si debe revisarla una persona.
async function aplicar(tipo, id, resultado) {
  const aprobar = resultado.decision === 'aprobar'
  const comunes = {
    p_id: id,
    p_decision: resultado.decision,
    p_motivo: aprobar ? null : resultado.motivo + PEDIR_REVISION,
    p_admin: null,
  }
  if (tipo === 'identidad' && aprobar) {
    const { error } = await supabaseAdmin
      .from(TABLAS.identidad)
      .update({ documento_hash: huellaDocumento(resultado.numero) })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }
  const { error } =
    tipo === 'identidad'
      ? await supabaseAdmin.rpc('resolver_verificacion_identidad', {
          ...comunes,
          p_coincide_fiscal: resultado.coincideFiscal || null,
        })
      : await supabaseAdmin.rpc('resolver_verificacion_centro', comunes)
  // 23505: ese documento o CIF ya verifica otra cuenta.
  if (error?.code === '23505') return false
  if (error) throw new Error(error.message)
  await supabaseAdmin.from(TABLAS[tipo]).update({ metodo: 'automatico' }).eq('id', id)
  return true
}

// Comprobación automática de una solicitud propia: { tipo, id, nombre?, numero? }.
// El nombre y el número solo se usan para comparar: no se guardan.
export async function POST(request) {
  const sesion = await usuarioDePeticion(request)
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const cuerpo = (await request.json().catch(() => null)) || {}
  const { tipo, id } = cuerpo
  if (!['identidad', 'centro'].includes(tipo) || typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  const usuarioId = sesion.usuario.id

  // Un solo análisis por solicitud.
  const { data: filas, error } = await supabaseAdmin
    .from(TABLAS[tipo])
    .update({ analizado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .eq('estado', 'pendiente')
    .is('analizado_en', null)
    .select('*')
  if (error) return NextResponse.json({ error: 'No se pudo comprobar' }, { status: 500 })
  if (!filas?.length) return NextResponse.json({ resultado: 'pendiente' })

  try {
    const resultado =
      tipo === 'identidad' ? await analizarIdentidad(filas[0], usuarioId, cuerpo) : await analizarCentro(filas[0], usuarioId)
    if (resultado.decision !== 'manual' && (await aplicar(tipo, id, resultado))) {
      await purgarArchivos(supabaseAdmin, { incluirHuerfanos: false }).catch((e) =>
        console.error('Verificaciones: limpieza fallida.', e.message)
      )
      return NextResponse.json({
        resultado: resultado.decision === 'aprobar' ? 'aprobada' : 'rechazada',
        motivo: resultado.decision === 'aprobar' ? null : resultado.motivo,
      })
    }
  } catch (fallo) {
    console.error('Verificaciones: la comprobación automática ha fallado.', fallo.message)
  }
  await avisarAdmin(supabaseAdmin, { tipo, id, usuarioId }).catch((e) =>
    console.error('Verificaciones: no se pudo avisar.', e.message)
  )
  return NextResponse.json({ resultado: 'pendiente' })
}
