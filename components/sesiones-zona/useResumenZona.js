'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { useBloqueados } from '../../lib/useBloqueados'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'

// Resumen diario de «Avisos de sesiones en mi zona» (Fase 5). Carga el resumen
// indicado en ?r=<id> (o el último del usuario si no hay id) y las sesiones que
// contó, para que la pantalla coincida con la cifra de la notificación. RLS: cada
// usuario solo puede leer SUS resúmenes. Las sesiones que desde entonces se han
// cancelado, llenado o empezado no se muestran (el aviso sigue siendo válido).
export default function useResumenZona() {
  const resumenId = useSearchParams().get('r')
  const [usuario, setUsuario] = useState(undefined) // undefined = cargando, null = sin sesión
  const [resumen, setResumen] = useState(null)
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const bloqueadosIds = useBloqueados(usuario || null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setUsuario(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (usuario === undefined) return
    if (!usuario) { setCargando(false); return }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError('')
      let consulta = supabase.from('avisos_zona_resumenes').select('*').eq('usuario_id', usuario.id)
      consulta = resumenId
        ? consulta.eq('id', resumenId)
        : consulta.order('dia', { ascending: false }).limit(1)
      const { data: filas, error: errRes } = await consulta
      if (cancelado) return
      if (errRes) {
        setError('No hemos podido cargar el resumen. Inténtalo de nuevo en unos minutos.')
        setCargando(false)
        return
      }
      const r = filas?.[0] || null
      setResumen(r)
      if (r) {
        const { data: sesiones, error: errCl } = await supabase
          .from('clases')
          .select('*, perfiles(username, foto_url)')
          .in('id', r.clases_ids)
          .eq('estado', 'activa')
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true })
        if (cancelado) return
        if (errCl) setError('No hemos podido cargar las sesiones. Inténtalo de nuevo en unos minutos.')
        else setClases(sesiones || [])
      }
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [usuario, resumenId])

  const visibles = clases.filter((c) => !claseYaPaso(c) && !bloqueadosIds.includes(c.trainer_id))

  function handleReservado(claseId, plazas) {
    setClases((prev) => prev.map((c) => (c.id === claseId ? { ...c, plazas_ocupadas: plazas } : c)))
  }

  return { usuario, resumen, clases: visibles, cargando, error, setError, handleReservado }
}
