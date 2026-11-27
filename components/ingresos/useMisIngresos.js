'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

// Sesión y datos de «Mis ingresos» (sql/105): la base de datos solo devuelve lo del propio organizador.
export default function useMisIngresos() {
  const router = useRouter()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion.session?.user) {
        router.push('/login')
        return
      }
      const { data, error: errorRpc } = await supabase.rpc('mis_ingresos')
      if (!vivo) return
      if (errorRpc) {
        setError(`No hemos podido cargar tus ingresos. Inténtalo en unos minutos. (Error ${errorRpc.code || 'desconocido'})`)
      } else {
        setDatos(data)
      }
      setCargando(false)
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [router])

  return { datos, error, cargando }
}
