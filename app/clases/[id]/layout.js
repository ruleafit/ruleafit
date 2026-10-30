import { createClient } from '@supabase/supabase-js'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../../lib/imagenesCategoria'
import { formatearFechaParaMostrar } from '../../../lib/formatoFecha'

// Vista previa al compartir el enlace de una sesión (WhatsApp, Telegram,
// Facebook, X...): título, descripción y foto de la categoría. La página de la
// sesión es un componente de cliente, así que los metadatos se generan aquí,
// en el servidor, leyendo la sesión con la clave pública (la política RLS solo
// deja ver sesiones activas; si no se puede leer, se usan los metadatos
// generales de la web).
export async function generateMetadata({ params }) {
  const { id } = await params

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data: clase } = await supabase
      .from('clases')
      .select('titulo, ciudad, fecha, hora, categoria, tipo_actividad, precio')
      .eq('id', id)
      .maybeSingle()

    if (!clase) return {}

    const hora = clase.hora ? String(clase.hora).slice(0, 5) : ''
    const cuando = [formatearFechaParaMostrar(clase.fecha), hora && `${hora} h`].filter(Boolean).join(' · ')
    const precio = clase.precio != null ? (Number(clase.precio) === 0 ? 'Gratis' : `${clase.precio} €`) : ''
    const titulo = `${clase.titulo} · ${clase.ciudad}`
    const descripcion = [cuando, clase.tipo_actividad, precio].filter(Boolean).join(' · ')
    const imagen = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO

    return {
      title: titulo,
      description: descripcion,
      openGraph: { title: titulo, description: descripcion, type: 'website', images: [imagen] },
      twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
    }
  } catch {
    return {}
  }
}

export default function LayoutSesion({ children }) {
  return children
}
