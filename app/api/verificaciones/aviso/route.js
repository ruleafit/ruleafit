import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { usuarioDePeticion, UUID } from '../../../../lib/verificaciones/sesion'
import { avisarAdmin, TABLAS } from '../../../../lib/verificaciones/aviso'

// Avisa al administrador de una solicitud propia que queda para revisión manual.
export async function POST(request) {
  const sesion = await usuarioDePeticion(request)
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo, id } = (await request.json().catch(() => null)) || {}
  if (!Object.hasOwn(TABLAS, tipo) || typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 })
  }

  try {
    await avisarAdmin(supabaseAdmin, { tipo, id, usuarioId: sesion.usuario.id })
  } catch (error) {
    console.error('Verificaciones: no se pudo avisar.', error.message)
    return NextResponse.json({ error: 'No se pudo avisar' }, { status: 500 })
  }
  // La solicitud ya está guardada: un fallo del correo no se le muestra al usuario.
  return NextResponse.json({ ok: true })
}
