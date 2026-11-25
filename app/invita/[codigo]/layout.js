import { IMAGEN_POR_DEFECTO } from '../../../lib/imagenesCategoria'

// C25 · Vista previa del enlace de invitación (WhatsApp, Telegram, Facebook, X...). Es la misma para todos los códigos
// y no incluye ningún dato privado: no revela quién invita. No se indexa en buscadores.
const TITULO = 'Te invitan a RuleaFit'
const DESCRIPCION = 'Únete a RuleaFit y consigue 20 Rulos extra. ¡Descubre actividades deportivas cerca de ti!'

export const metadata = {
  title: TITULO,
  description: DESCRIPCION,
  robots: { index: false, follow: false },
  openGraph: { title: TITULO, description: DESCRIPCION, type: 'website', siteName: 'RuleaFit', images: [IMAGEN_POR_DEFECTO] },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION, images: [IMAGEN_POR_DEFECTO] },
}

export default function LayoutInvitacion({ children }) {
  return children
}
