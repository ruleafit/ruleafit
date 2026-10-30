import { supabaseAdmin } from './supabaseAdmin'

// Solo servidor. Comprueba que la petición viene de un administrador: lleva un
// token de sesión de Supabase (cabecera Authorization: Bearer ...), el token es
// válido, el correo de la cuenta está confirmado y coincide con alguno de los
// correos de administración (variable ADMIN_EMAILS, separados por comas; si no
// existe se usa FEEDBACK_ADMIN_EMAIL, el correo que ya recibe los avisos).
// Devuelve el usuario o null.
export async function verificarAdmin(request) {
  const cabecera = request.headers.get('authorization') || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : ''
  if (!token) return null

  const permitidos = (process.env.ADMIN_EMAILS || process.env.FEEDBACK_ADMIN_EMAIL || '')
    .split(',')
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean)
  if (permitidos.length === 0) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  const usuario = data?.user
  if (error || !usuario || !usuario.email || !usuario.email_confirmed_at) return null

  return permitidos.includes(usuario.email.toLowerCase()) ? usuario : null
}
