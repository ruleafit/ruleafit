import { supabase } from './supabaseClient'

// Los avisos de «sesiones en mi zona» son frecuentes y menos urgentes que reservas,
// cancelaciones o recordatorios. Para que no los desplacen, se piden APARTE: hasta 10
// notificaciones normales y hasta 3 avisos de zona, y se mezclan por fecha.
// La purga diaria de la base de datos sigue la misma regla (sql/083).
export const TIPOS_ZONA = ['sesion_zona', 'resumen_zona']
const LISTA_ZONA = `(${TIPOS_ZONA.join(',')})`
const COLUMNAS = 'id, tipo, titulo, cuerpo, url, leido, created_at'

export async function cargarNotificaciones(usuarioId, { soloNoLeidas = false } = {}) {
  function base() {
    let q = supabase.from('notificaciones_historial').select(COLUMNAS).eq('usuario_id', usuarioId)
    if (soloNoLeidas) q = q.eq('leido', false)
    return q.order('created_at', { ascending: false })
  }
  const [normales, zona] = await Promise.all([
    base().not('tipo', 'in', LISTA_ZONA).limit(10),
    base().in('tipo', TIPOS_ZONA).limit(3),
  ])
  if (normales.error && zona.error) return null
  return [...(normales.data || []), ...(zona.data || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
}
