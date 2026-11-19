import { supabase } from '../lib/supabaseClient'

const BASE = 'https://www.ruleafit.com'

// Se regenera como mucho cada hora: las sesiones nuevas aparecen sin tocar el código.
export const revalidate = 3600

// Páginas públicas fijas. /entrenadores, /publicar, /cuenta, /mis-* y demás piden
// sesión, así que no se listan.
const PAGINAS = [
  { ruta: '', frecuencia: 'daily', prioridad: 1 },
  { ruta: '/clases', frecuencia: 'hourly', prioridad: 0.9 },
  { ruta: '/ayuda', frecuencia: 'monthly', prioridad: 0.4 },
  { ruta: '/privacidad', frecuencia: 'yearly', prioridad: 0.2 },
  { ruta: '/aviso-legal', frecuencia: 'yearly', prioridad: 0.2 },
]

export default async function sitemap() {
  const ahora = new Date()
  const fijas = PAGINAS.map((p) => ({
    url: `${BASE}${p.ruta}`,
    lastModified: ahora,
    changeFrequency: p.frecuencia,
    priority: p.prioridad,
  }))

  // Sesiones activas y futuras (la política de lectura pública solo deja ver las activas).
  // Si la consulta falla, el sitemap se sirve igualmente con las páginas fijas.
  let sesiones = []
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('clases')
      .select('id, fecha')
      .eq('estado', 'activa')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
      .limit(1000)
    sesiones = (data || []).map((c) => ({
      url: `${BASE}/clases/${c.id}`,
      lastModified: ahora,
      changeFrequency: 'daily',
      priority: 0.6,
    }))
  } catch {
    sesiones = []
  }

  return [...fijas, ...sesiones]
}
