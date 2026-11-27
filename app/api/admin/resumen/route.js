import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { SECCIONES } from '../../../../lib/admin/secciones'

const sinCache = { headers: { 'Cache-Control': 'no-store' } }

// Dice a quien pregunta si es administrador (sin revelar la lista de correos) y,
// con ?pendientes=1, cuánto hay por revisar en cada apartado. Responde 200 a
// cualquiera para que el menú no genere errores a los demás usuarios.
export async function GET(request) {
  if (!(await verificarAdmin(request))) return NextResponse.json({ admin: false }, sinCache)

  if (!new URL(request.url).searchParams.has('pendientes')) {
    return NextResponse.json({ admin: true }, sinCache)
  }
  const secciones = await Promise.all(
    SECCIONES.map(async ({ href, titulo, descripcion, pendientes }) => ({
      href,
      titulo,
      descripcion,
      pendientes: await pendientes(supabaseAdmin).catch(() => null),
    }))
  )
  return NextResponse.json({ admin: true, secciones }, sinCache)
}
