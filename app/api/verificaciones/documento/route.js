import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { verificarAdmin } from '../../../../lib/adminAuth'
import { usuarioDePeticion, UUID } from '../../../../lib/verificaciones/sesion'
import { BUCKET_TITULACIONES, textoMarcaDeAgua } from '../../../../lib/verificaciones/reglas'
import { renderizarPagina, DocumentoNoValido, MAX_PAGINAS } from '../../../../lib/verificaciones/renderizar'

export const maxDuration = 30

const error = (mensaje, status) =>
  NextResponse.json({ error: mensaje }, { status, headers: { 'Cache-Control': 'no-store' } })

// La visibilidad (aprobada y sin bloqueo) la decide la base de datos con la
// sesión de quien pide el documento.
async function visibleParaUsuario(token, propietario, titulacionId) {
  const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data } = await cliente.rpc('titulaciones_publicas', { p_usuario: propietario })
  return !!data?.some((t) => t.id === titulacionId)
}

// Una página de un diploma como imagen con marca de agua. Solo con sesión:
// titulaciones aprobadas, las propias y, para revisarlas, los administradores.
export async function GET(request) {
  const sesion = await usuarioDePeticion(request)
  if (!sesion) return error('Inicia sesión para ver el documento.', 401)

  const parametros = new URL(request.url).searchParams
  const id = parametros.get('id') || ''
  const pagina = Number(parametros.get('pagina') || 1)
  if (!UUID.test(id) || !Number.isInteger(pagina) || pagina < 1 || pagina > MAX_PAGINAS) {
    return error('Datos no válidos', 400)
  }

  const { data: titulacion } = await supabaseAdmin
    .from('titulaciones')
    .select('usuario_id, ruta')
    .eq('id', id)
    .maybeSingle()
  const permitido =
    !!titulacion?.ruta &&
    (titulacion.usuario_id === sesion.usuario.id ||
      (await visibleParaUsuario(sesion.token, titulacion.usuario_id, id)) ||
      !!(await verificarAdmin(request)))
  if (!permitido) return error('Documento no disponible.', 404)

  const { data: archivo, error: errorDescarga } = await supabaseAdmin.storage
    .from(BUCKET_TITULACIONES)
    .download(titulacion.ruta)
  if (errorDescarga) return error('No se pudo abrir el documento.', 500)

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('username')
    .eq('id', sesion.usuario.id)
    .maybeSingle()

  try {
    const { jpeg, paginas } = await renderizarPagina(
      Buffer.from(await archivo.arrayBuffer()),
      pagina,
      textoMarcaDeAgua({ username: perfil?.username, email: sesion.usuario.email })
    )
    return new Response(jpeg, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Paginas': String(paginas),
      },
    })
  } catch (fallo) {
    if (fallo instanceof DocumentoNoValido) return error(fallo.message, 422)
    console.error('Verificaciones: no se pudo generar la vista del documento.', fallo.message)
    return error('No se pudo abrir el documento.', 500)
  }
}
