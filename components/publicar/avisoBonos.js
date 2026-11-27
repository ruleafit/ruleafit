import { supabase } from '../../lib/supabaseClient'

// Antes de guardar una restricción de bonos (sql/113): si deja bonos ya vendidos sin ninguna sesión próxima, se
// avisa y se pide confirmación. La cuenta la hace la base de datos. Devuelve false si se decide no guardar.
export async function confirmarBonosSinSesiones({ claseId = null, alcance = 'solo_esta', bonos }) {
  if (bonos == null) return true // admite todos: nadie se queda sin sesiones
  const { data: n, error } = await supabase.rpc('previsualizar_bonos_sesion', {
    p_clase_id: claseId,
    p_alcance: alcance,
    p_bonos: bonos,
  })
  if (error || !n) return true // el derecho del cliente lo aplica el servidor igualmente
  const texto =
    n === 1
      ? '1 bono que ya has vendido se quedará sin ninguna sesión próxima donde usarse. Avisaremos a esa persona y podrá pedir gratis la devolución de lo no usado.'
      : `${n} bonos que ya has vendido se quedarán sin ninguna sesión próxima donde usarse. Avisaremos a esas personas y podrán pedir gratis la devolución de lo no usado.`
  return window.confirm(`${texto} ¿Guardar igualmente?`)
}
