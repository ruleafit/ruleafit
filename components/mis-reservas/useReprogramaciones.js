'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Cambios pendientes de respuesta, por reserva. Si la función aún no existe o falla, no se muestra nada.
export default function useReprogramaciones(usuario, alCancelar) {
  const [pendientes, setPendientes] = useState({})
  const [respondiendoId, setRespondiendoId] = useState(null)
  const [errores, setErrores] = useState({})

  useEffect(() => {
    if (!usuario) return
    let vivo = true
    supabase.rpc('mis_reprogramaciones_pendientes').then(({ data }) => {
      if (vivo && Array.isArray(data)) setPendientes(Object.fromEntries(data.map((x) => [x.reserva_id, x])))
    })
    return () => {
      vivo = false
    }
  }, [usuario])

  async function responder(reservaId, aceptar) {
    const cambio = pendientes[reservaId]
    if (!cambio) return
    if (!aceptar && !window.confirm('¿Seguro que quieres cancelar tu reserva por este cambio? No tiene coste y no se puede deshacer.')) return
    setRespondiendoId(reservaId)
    setErrores((prev) => ({ ...prev, [reservaId]: '' }))
    const { data, error } = await supabase.rpc('responder_reprogramacion', {
      p_respuesta_id: cambio.respuesta_id,
      p_aceptar: aceptar,
    })
    setRespondiendoId(null)
    if (error) {
      setErrores((prev) => ({ ...prev, [reservaId]: error.message }))
      return
    }
    setPendientes((prev) => {
      const siguiente = { ...prev }
      delete siguiente[reservaId]
      return siguiente
    })
    if (data?.resultado === 'cancelada') alCancelar(reservaId, data)
  }

  return { pendientes, respondiendoId, errores, responder }
}
