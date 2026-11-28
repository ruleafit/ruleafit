import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../../lib/adminAuth'
import { generarPain001, ordenanteDesdeEntorno } from '../../../../../lib/pagos/sepa.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIN_CACHE = { 'Cache-Control': 'no-store' }

const noAutorizado = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 })

function fallo(error) {
  const legible = ['P0001', 'P0002'].includes(error.code)
  return NextResponse.json({ error: legible ? error.message : 'No se ha podido completar' }, { status: legible ? 400 : 500 })
}

// Resumen de ficheros (sin IBAN) y si faltan datos del ordenante. Solo administradores.
export async function GET(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { data, error } = await supabaseAdmin.rpc('panel_ficheros_sepa')
  if (error) return NextResponse.json({ error: 'No se pudieron leer los ficheros' }, { status: 500 })
  const config = ordenanteDesdeEntorno()
  return NextResponse.json({ ...data, faltan: config.faltan || [] }, { headers: SIN_CACHE })
}

// { accion: 'generar' } crea un fichero y lo devuelve; { accion: 'descargar', fichero } devuelve el mismo otra vez.
// El XML lleva los IBAN: se genera al momento, no se guarda ni se registra.
export async function POST(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const cuerpo = (await request.json().catch(() => null)) || {}
  if (!['generar', 'descargar'].includes(cuerpo.accion) || (cuerpo.accion === 'descargar' && !UUID.test(String(cuerpo.fichero)))) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  // Antes de reservar ninguna transferencia: sin datos del ordenante no se genera nada.
  const config = ordenanteDesdeEntorno()
  if (config.faltan) {
    return NextResponse.json({ error: `Faltan datos del ordenante: ${config.faltan.join(', ')}` }, { status: 503 })
  }
  let id = cuerpo.fichero
  if (cuerpo.accion === 'generar') {
    const { data, error } = await supabaseAdmin.rpc('preparar_fichero_sepa')
    if (error) return fallo(error)
    id = data.fichero_id
  }
  const { data, error } = await supabaseAdmin.rpc('datos_fichero_sepa', { p_fichero: id })
  if (error) return fallo(error)
  try {
    const xml = generarPain001(config.ordenante, data)
    return NextResponse.json({ nombre: `${data.referencia}.xml`, xml }, { headers: SIN_CACHE })
  } catch (e) {
    return NextResponse.json({ error: `${e.message}. Descarta el fichero y revisa esa transferencia.` }, { status: 400 })
  }
}

// { accion: 'enviado' | 'descartado', fichero }: marca en bloque. No envía dinero.
export async function PATCH(request) {
  if (!(await verificarAdmin(request))) return noAutorizado()
  const { accion, fichero } = (await request.json().catch(() => null)) || {}
  if (!['enviado', 'descartado'].includes(accion) || !UUID.test(String(fichero))) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.rpc('cerrar_fichero_sepa', { p_fichero: fichero, p_estado: accion })
  return error ? fallo(error) : NextResponse.json({ ok: true })
}
