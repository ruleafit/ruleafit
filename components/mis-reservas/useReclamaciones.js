'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Casos propios y reservas sobre las que se puede reclamar (sql/098). RLS: cada persona solo ve lo suyo.
export default function useReclamaciones() {
  const [casos, setCasos] = useState([])
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [rc, rr] = await Promise.all([
      supabase
        .from('incidencias_pago')
        .select('id, numero, tipo, estado, descripcion, respuesta, clase_titulo, clase_fecha, reserva_id, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase.rpc('mis_reservas_reclamables'),
    ])
    if (rc.error || rr.error) {
      setError('No hemos podido cargar tus reclamaciones. Inténtalo en unos minutos o escríbenos desde Ayuda.')
    } else {
      setError('')
      setCasos(rc.data || [])
      // Además de reservas y pagos sin plaza, los bonos pagados online (sql/107).
      const [rb, re] = await Promise.all([supabase.rpc('mis_bonos_comprados'), supabase.rpc('mis_bonos_estado')])
      const yaEstan = new Set((rr.data || []).map((x) => x.cobro_id))
      const bonos = (rb.data || [])
        .map((b) => ({
          cobro_id: re.data?.[b.bono_cliente_id]?.cobro_id,
          titulo: `Bono de ${b.numero_sesiones} sesiones · @${b.trainer_username}`,
        }))
        .filter((x) => x.cobro_id && !yaEstan.has(x.cobro_id))
      setReservas([...(rr.data || []), ...bonos])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // reservaId = id de la opción elegida: una reserva o, si es un pago sin plaza, su cobro (sql/103).
  async function abrir({ reservaId, tipo, descripcion }) {
    const sinPlaza = reservas.some((x) => x.cobro_id === reservaId)
    const { data, error: errorRpc } = await supabase.rpc(sinPlaza ? 'abrir_incidencia_cobro' : 'abrir_incidencia', {
      [sinPlaza ? 'p_cobro_id' : 'p_reserva_id']: reservaId,
      p_tipo: tipo,
      p_descripcion: descripcion,
    })
    if (errorRpc) {
      // P0001/P0002: mensajes escritos para la persona. Cualquier otro error no se enseña tal cual.
      return { error: ['P0001', 'P0002'].includes(errorRpc.code) ? errorRpc.message : 'No se ha podido enviar. Inténtalo de nuevo.' }
    }
    await cargar()
    return { numero: data?.numero }
  }

  return { casos, reservas, cargando, error, abrir }
}
