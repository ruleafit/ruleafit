import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { UUID } from '../../../../lib/verificaciones/sesion'
import { compararDocumento, normalizarDocumento } from '../../../../lib/verificaciones/reglas'
import { purgarArchivos } from '../../../../lib/verificaciones/purga'

const NO_AUTORIZADO = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 })

// Cola de revisión: solicitudes pendientes y aprobadas (para poder revocar).
export async function GET(request) {
  if (!(await verificarAdmin(request))) return NO_AUTORIZADO()

  // Cada visita al panel reintenta los borrados que hubieran fallado.
  await purgarArchivos(supabaseAdmin).catch((e) => console.error('Verificaciones: limpieza fallida.', e.message))

  const [identidades, titulaciones] = await Promise.all([
    supabaseAdmin
      .from('verificaciones_identidad')
      .select('id, usuario_id, tipo_documento, ruta_reverso, estado, coincide_fiscal, created_at, revisado_en')
      .in('estado', ['pendiente', 'aprobada'])
      .order('created_at', { ascending: true })
      .limit(300),
    supabaseAdmin
      .from('titulaciones')
      .select('id, usuario_id, nombre, entidad, anio, estado, created_at, revisado_en')
      .in('estado', ['pendiente', 'aprobada'])
      .order('created_at', { ascending: true })
      .limit(500),
  ])
  if (identidades.error || titulaciones.error) {
    return NextResponse.json({ error: 'No se pudieron leer las solicitudes' }, { status: 500 })
  }

  const ids = [...new Set([...identidades.data, ...titulaciones.data].map((f) => f.usuario_id))]
  const [perfiles, fiscales] = ids.length
    ? await Promise.all([
        supabaseAdmin.from('perfiles').select('id, username').in('id', ids),
        supabaseAdmin.from('perfiles_fiscales').select('usuario_id, nombre_fiscal, nif').in('usuario_id', ids),
      ])
    : [{ data: [] }, { data: [] }]
  const usernames = new Map((perfiles.data || []).map((p) => [p.id, p.username]))
  const fiscal = new Map((fiscales.data || []).map((f) => [f.usuario_id, f]))

  return NextResponse.json({
    identidades: identidades.data.map(({ ruta_reverso, ...v }) => ({
      ...v,
      tiene_reverso: !!ruta_reverso,
      username: usernames.get(v.usuario_id) || null,
      // El NIF no sale del servidor: la coincidencia se comprueba al aprobar.
      nombre_fiscal: fiscal.get(v.usuario_id)?.nombre_fiscal || null,
      tiene_fiscal: fiscal.has(v.usuario_id),
    })),
    titulaciones: titulaciones.data.map((t) => ({ ...t, username: usernames.get(t.usuario_id) || null })),
  })
}

// Resolver: { tipo, id, decision: aprobar|rechazar|revocar, motivo?, numeroDocumento?, confirmarDiscrepancia? }
export async function PATCH(request) {
  const admin = await verificarAdmin(request)
  if (!admin) return NO_AUTORIZADO()

  const { tipo, id, decision, motivo, numeroDocumento, confirmarDiscrepancia } =
    (await request.json().catch(() => null)) || {}
  if (
    !['identidad', 'titulacion'].includes(tipo) ||
    typeof id !== 'string' ||
    !UUID.test(id) ||
    !['aprobar', 'rechazar', 'revocar'].includes(decision) ||
    (motivo != null && (typeof motivo !== 'string' || motivo.length > 500))
  ) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  let coincidencia = null
  if (tipo === 'identidad' && decision === 'aprobar') {
    const { data: fila } = await supabaseAdmin
      .from('verificaciones_identidad')
      .select('usuario_id')
      .eq('id', id)
      .maybeSingle()
    if (!fila) return NextResponse.json({ error: 'La solicitud ya no existe.' }, { status: 404 })
    const { data: fiscal, error } = await supabaseAdmin
      .from('perfiles_fiscales')
      .select('nif')
      .eq('usuario_id', fila.usuario_id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'No se pudo comprobar el perfil fiscal' }, { status: 500 })
    if (fiscal && !normalizarDocumento(numeroDocumento)) {
      return NextResponse.json({ error: 'Escribe el número del documento para compararlo con el NIF fiscal.' }, { status: 400 })
    }
    coincidencia = compararDocumento(numeroDocumento, fiscal?.nif)
    if (coincidencia === 'no_coincide' && confirmarDiscrepancia !== true) {
      return NextResponse.json(
        { error: 'El número no coincide con el NIF del perfil fiscal.', requiereConfirmacion: true },
        { status: 409 }
      )
    }
  }

  const { error } =
    tipo === 'identidad'
      ? await supabaseAdmin.rpc('resolver_verificacion_identidad', {
          p_id: id,
          p_decision: decision,
          p_motivo: motivo || null,
          p_admin: admin.id,
          p_coincide_fiscal: coincidencia,
        })
      : await supabaseAdmin.rpc('resolver_titulacion', {
          p_id: id,
          p_decision: decision,
          p_motivo: motivo || null,
          p_admin: admin.id,
        })
  if (error) {
    return NextResponse.json(
      { error: error.code === 'P0001' ? error.message : 'No se pudo guardar la decisión' },
      { status: error.code === 'P0001' ? 409 : 500 }
    )
  }

  // La decisión ya está guardada; si el borrado falla, queda en la cola.
  const limpieza = await purgarArchivos(supabaseAdmin, { incluirHuerfanos: false }).catch(() => null)
  return NextResponse.json({ ok: true, coincidencia, borradoPendiente: !limpieza || limpieza.pendientes > 0 })
}
