import { createClient } from '@supabase/supabase-js'
import { IMAGEN_POR_DEFECTO } from '../../../lib/imagenesCategoria'

// C25 · Vista previa al compartir el enlace de un perfil público (WhatsApp, Telegram, Facebook, X...): nombre público,
// una descripción pública breve y la foto de perfil si existe (si no, la imagen predeterminada de RuleaFit). La
// página es un componente de cliente, así que los metadatos se generan aquí, en el servidor, con la clave pública:
// solo se leen campos que ya son públicos (nombre de usuario, descripción y foto). Nunca correo ni datos privados.
// Las plataformas guardan la vista previa en caché un tiempo.
const FORMATO_USUARIO = /^[A-Za-z0-9_]{3,20}$/

export async function generateMetadata({ params }) {
  const { username } = await params
  if (!FORMATO_USUARIO.test(String(username))) return {}

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('username, descripcion, foto_url')
      .ilike('username', String(username).replace(/_/g, '\\_')) // sin distinguir mayúsculas; el guion bajo es literal
      .limit(1)
    const exacto = (perfil || [])[0]
    if (!exacto) return {}

    const titulo = `@${exacto.username} en RuleaFit`
    const texto = String(exacto.descripcion || '').replace(/\s+/g, ' ').trim()
    const descripcion = texto
      ? texto.length > 160 ? `${texto.slice(0, 157)}…` : texto
      : `Descubre las sesiones de @${exacto.username} en RuleaFit.`
    const imagen = /^https:\/\//.test(exacto.foto_url || '') ? exacto.foto_url : IMAGEN_POR_DEFECTO

    return {
      title: titulo,
      description: descripcion,
      openGraph: { title: titulo, description: descripcion, type: 'profile', images: [imagen] },
      twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
    }
  } catch {
    return {}
  }
}

export default function LayoutPerfilPublico({ children }) {
  return children
}
