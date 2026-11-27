import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { UUID } from '../../../../lib/verificaciones/sesion'
import { compararDocumento, normalizarDocumento } from '../../../../lib/verificaciones/reglas'
import { huellaDocumento } from '../../../../lib/verificaciones/huella'
import { TABLAS } from '../../../../lib/verificaciones/aviso'
import { purgarArchivos } from '../../../../lib/verificaciones/purga'

const NO_AUTORIZADO = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 })

// Cola de revisión: solicitudes pendientes y aprobadas (para poder revocar).
export async function GET(request) {
  if (!(await verificarAdmin(request))) return NO_AUTORIZADO()

  // Cada visita al panel reintenta los borrados que hubieran fallado.
  await purgarArchivos(supabaseAdmin).catch((e) => console.error('Verificaciones: limpieza fallida.', e.message))

  const [identidades, titulaciones, centros] = await Promise.all([
    supabaseAdmin
      .from('verificaciones_identidad')
      .select('id, usuario_id, tipo_documento, ruta_reverso, estado, coincide_fiscal, metodo, created_at, revisado_en')
      .in('estado', ['pendiente', 'aprobada'])
      .order('created_at', { ascending: true })
      .limit(300),
    supabaseAdmin
      .from('titulaciones')
      .select('id, usuario_id, nombre, entidad, anio, estado, created_at, revisado_en')
      .in('estado', ['pendiente', 'aprobada'])
      .order('created_at', { ascending: true })
      .limit(500),
    supabaseAdmin
      .from('verificaciones_centro')
      .select('id, usuario_id, razon_social, cif, estado, metodo, created_at, revisado_en')
      .in('estado', ['pendiente', 'aprobada'])
      .order('created_at', { ascending: true })
      .limit(300),
  ])
  if (identidades.error || titulaciones.error || centros.error) {
    return NextResponse.json({ error: 'No se pudieron leer las solicitudes' }, { status: 500 })
  }

  const ids = [...new Set([...identidades.data, ...titulaciones.data, ...centros.data].map((f) => f.usuario_id))]
  const [perfiles, fiscales] = ids.length
    ? await Promise.all([
        supabaseAdmin.from('perfiles').select('id, username').in('id', ids),
        supabaseAdmin.from('perfiles_fiscales').select('usuario_id, tipo, nombre_fiscal, nif').in('usuario_id', ids),
      ])
    : [{ data: [] }, { data: [] }]
  const usernames = new Map((perfiles.data || []).map((p) => [p.id, p.username]))
  const fiscal = new Map((fiscales.data || []).map((f) => [f.usuario_id, f]))

  // La identidad se compara con el perfil fiscal solo si es de una persona.
  const persona = (id) => (fiscal.get(id)?.tipo === 'sociedad' ? null : fiscal.get(id))

  // Denuncias sin revisar de cada titulación (sql/111).
  const { data: denuncias } = await supabaseAdmin
    .from('denuncias')
    .select('objetivo_id')
    .eq('tipo', 'titulacion')
    .eq('estado', 'pendiente')
    .limit(500)
  const denunciadas = new Map()
  for (const d of denuncias || []) denunciadas.set(d.objetivo_id, (denunciadas.get(d.objetivo_id) || 0) + 1)

  return NextResponse.json({
    identidades: identidades.data.map(({ ruta_reverso, ...v }) => ({
      ...v,
      tiene_reverso: !!ruta_reverso,
      username: usernames.get(v.usuario_id) || null,
      // El NIF no sale del servidor: la coincidencia se comprueba al aprobar.
      nombre_fiscal: persona(v.usuario_id)?.nombre_fiscal || null,
      tiene_fiscal: !!persona(v.usuario_id),
    })),
    centros: centros.data.map((c) => {
      const f = fiscal.get(c.usuario_id)
      return {
        ...c,
        username: usernames.get(c.usuario_id) || null,
        fiscal: f?.tipo === 'sociedad' ? `${f.nombre_fiscal} — ${f.nif}` : null,
      }
    }),
    titulaciones: titulaciones.data.map((t) => ({
      ...t,
      username: usernames.get(t.usuario_id) || null,
      denuncias: denunciadas.get(t.id) || 0,
    })),
  })
}

// Resolver: { tipo, id, decision: aprobar|rechazar|revocar, motivo?, numeroDocumento?, confirmarDiscrepancia? }
export async function PATCH(request) {
  const admin = await verificarAdmin(request)
  if (!admin) return NO_AUTORIZADO()

  const { tipo, id, decision, motivo, numeroDocumento, confirmarDiscrepancia } =
    (await request.json().catch(() => null)) || {}
  if (
    !Object.hasOwn(TABLAS, tipo) ||
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
    const { data: perfilFiscal, error } = await supabaseAdmin
      .from('perfiles_fiscales')
      .select('tipo, nif')
      .eq('usuario_id', fila.usuario_id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'No se pudo comprobar el perfil fiscal' }, { status: 500 })
    const fiscal = perfilFiscal?.tipo === 'sociedad' ? null : perfilFiscal
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

  if (tipo === 'identidad' && decision === 'aprobar' && normalizarDocumento(numeroDocumento)) {
    await supabaseAdmin.from(TABLAS.identidad).update({ documento_hash: huellaDocumento(numeroDocumento) }).eq('id', id)
  }

  const comunes = { p_id: id, p_decision: decision, p_motivo: motivo || null, p_admin: admin.id }
  const { error } =
    tipo === 'identidad'
      ? await supabaseAdmin.rpc('resolver_verificacion_identidad', { ...comunes, p_coincide_fiscal: coincidencia })
      : await supabaseAdmin.rpc(tipo === 'centro' ? 'resolver_verificacion_centro' : 'resolver_titulacion', comunes)
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Ese documento o CIF ya verifica otra cuenta. Retira antes la otra.' }, { status: 409 })
  }
  if (error) {
    return NextResponse.json(
      { error: error.code === 'P0001' ? error.message : 'No se pudo guardar la decisión' },
      { status: error.code === 'P0001' ? 409 : 500 }
    )
  }
  if (tipo !== 'titulacion' && decision !== 'revocar') {
    await supabaseAdmin.from(TABLAS[tipo]).update({ metodo: 'manual' }).eq('id', id)
  }

  // La decisión ya está guardada; si el borrado falla, queda en la cola.
  const limpieza = await purgarArchivos(supabaseAdmin, { incluirHuerfanos: false }).catch(() => null)
  return NextResponse.json({ ok: true, coincidencia, borradoPendiente: !limpieza || limpieza.pendientes > 0 })
}
