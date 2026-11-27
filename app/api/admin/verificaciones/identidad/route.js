import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../../lib/adminAuth'
import { UUID } from '../../../../../lib/verificaciones/sesion'
import { BUCKET_IDENTIDAD } from '../../../../../lib/verificaciones/reglas'

// URL firmada de 60 segundos de una cara del documento de identidad. Solo
// administradores y solo mientras la solicitud está pendiente.
export async function GET(request) {
  if (!(await verificarAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const parametros = new URL(request.url).searchParams
  const id = parametros.get('id') || ''
  const columna = parametros.get('cara') === 'reverso' ? 'ruta_reverso' : 'ruta_anverso'
  if (!UUID.test(id)) return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })

  const { data: fila } = await supabaseAdmin
    .from('verificaciones_identidad')
    .select('ruta_anverso, ruta_reverso')
    .eq('id', id)
    .eq('estado', 'pendiente')
    .maybeSingle()
  const ruta = fila?.[columna]
  if (!ruta) return NextResponse.json({ error: 'Documento no disponible' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage.from(BUCKET_IDENTIDAD).createSignedUrl(ruta, 60)
  if (error) return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } })
}
