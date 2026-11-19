import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso, horasAntesDeClase } from '../../lib/ventanaEdicionClase'

// Ya no depende del rol guardado (Fase 6 de la unificación de roles,
// 11 sept 2026): lo relevante es que no sea tu propio perfil, no un
// rol fijo. El candado real (haber entrenado con esta persona, o que
// el entrenador cancelase tu sesión con poca antelación) se calcula
// aquí de todos modos.
//
// Dos motivos por los que se puede valorar (pedido por el usuario el
// 2 de octubre de 2026, RLS ampliada en
// sql/066_valorar_tras_cancelacion_tardia_entrenador.sql):
//  1) una reserva activa cuya clase ya pasó (asistencia, el caso de
//     siempre).
//  2) una reserva que el propio entrenador canceló a mano
//     (reservas.cancelada_por_entrenador, que NUNCA se activa en la
//     autocancelación por no llegar al mínimo de plazas) con menos de
//     2 horas de antelación respecto al inicio de la clase.
//
// Devuelve { puedeValorar, valoracionPropia } (valoracionPropia = la que ya
// dejó, { id, estrellas, opinion }, o null).
export async function comprobarValoracion(usuarioId, entrenadorId) {
  const { data: reservasRelevantes } = await supabase
    .from('reservas')
    .select('id, estado, cancelled_at, cancelada_por_entrenador, clases(trainer_id, fecha, hora)')
    .eq('cliente_id', usuarioId)
    .in('estado', ['activa', 'cancelada'])

  const haCompletadoClase = (reservasRelevantes || []).some((reserva) => {
    if (reserva.clases?.trainer_id !== entrenadorId) return false

    if (reserva.estado === 'activa') {
      return claseYaPaso(reserva.clases)
    }

    if (reserva.cancelada_por_entrenador && reserva.cancelled_at) {
      const horas = horasAntesDeClase(reserva.clases, reserva.cancelled_at)
      return horas !== null && horas < 2
    }

    return false
  })

  if (!haCompletadoClase) return { puedeValorar: false, valoracionPropia: null }

  const { data: valoracionData } = await supabase
    .from('valoraciones')
    .select('id, estrellas, opinion')
    .eq('cliente_id', usuarioId)
    .eq('entrenador_id', entrenadorId)
    .maybeSingle()

  return { puedeValorar: true, valoracionPropia: valoracionData || null }
}
