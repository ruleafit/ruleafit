'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { escucharRetornoLogin } from '../lib/nativo'

// Solo hace algo dentro de la app de iPhone: recoge el regreso del inicio de
// sesión con Google (que se hace en el navegador del sistema) y lleva al inicio.
export default function ManejadorApp() {
  useEffect(() => {
    return escucharRetornoLogin(supabase, () => window.location.assign('/'))
  }, [])

  return null
}
