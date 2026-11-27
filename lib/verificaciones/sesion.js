import { supabaseAdmin } from '../supabaseAdmin'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Solo servidor. Usuario de la sesión (Authorization: Bearer ...) o null.
export async function usuarioDePeticion(request) {
  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  return { usuario: data.user, token }
}
