'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Estado de la suscripción propia (mi_pro, sql/107).
export default function usePro() {
  const [estado, setEstado] = useState('cargando') // cargando | sin_sesion | error | ok
  const [pro, setPro] = useState(null)

  const cargar = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession()
    if (!sesion.session) {
      setEstado('sin_sesion')
      return
    }
    const { data, error } = await supabase.rpc('mi_pro')
    if (error) {
      setEstado('error')
      return
    }
    setPro(data)
    setEstado('ok')
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { estado, pro, cargar }
}
