import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../../lib/adminAuth'
import { UUID } from '../../../../../lib/verificaciones/sesion'
import { BUCKET_IDENTIDAD, BUCKET_TITULACIONES } from '../../../../../lib/verificaciones/reglas'
import { TABLAS } from '../../../../../lib/verificaciones/aviso'

// URL firmada de 60 segundos de un documento. Es la ÚNICA forma de ver un
// documento: solo administradores. Identidad y centro, mientras están
// pendientes; los diplomas se conservan también aprobados (denuncias).
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const parametros = new URL(request.url).searchParams
  const id = parametros.get('id') || ''
  const tipo = parametros.get('tipo')
  if (!UUID.test(id) || !Object.hasOwn(TABLAS, tipo)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  const columna =
    tipo === 'identidad' ? (parametros.get('cara') === 'reverso' ? 'ruta_reverso' : 'ruta_anverso') : 'ruta'

  const { data: fila } = await supabaseAdmin
    .from(TABLAS[tipo])
    .select('*')
    .eq('id', id)
    .in('estado', tipo === 'titulacion' ? ['pendiente', 'aprobada'] : ['pendiente'])
    .maybeSingle()
  const ruta = fila?.[columna]
  if (!ruta) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })

  const bucket = tipo === 'titulacion' ? BUCKET_TITULACIONES : BUCKET_IDENTIDAD
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(ruta, 60)
  if (error) return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } })
}
