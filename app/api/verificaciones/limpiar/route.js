import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { purgarArchivos } from '../../../../lib/verificaciones/purga'

// Ejecuta la cola de borrado de archivos de verificación. No pide sesión a
// propósito (se llama también justo después de eliminar la cuenta): solo borra
// lo que la base de datos ya ha marcado para borrar y no devuelve datos.
export async function POST() {
  try {
    await purgarArchivos(supabaseAdmin)
  } catch (error) {
    console.error('Verificaciones: limpieza fallida.', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
