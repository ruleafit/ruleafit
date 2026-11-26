'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Carga y acciones de un panel de administración. El permiso lo decide SIEMPRE el servidor (lib/adminAuth.js).
export default function usePanelAdmin(url) {
  const [estadoCarga, setEstadoCarga] = useState('cargando') // cargando | ok | sin-sesion | sin-acceso | error
  const [datos, setDatos] = useState(null)

  const pedir = useCallback(
    async (metodo, cuerpo) => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return { sinSesion: true }
      const respuesta = await fetch(url, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      }).catch(() => null)
      return { respuesta }
    },
    [url]
  )

  const cargar = useCallback(async () => {
    const { sinSesion, respuesta } = await pedir('GET')
    if (sinSesion) return setEstadoCarga('sin-sesion')
    if (respuesta?.status === 403) return setEstadoCarga('sin-acceso')
    if (!respuesta?.ok) return setEstadoCarga('error')
    setDatos(await respuesta.json())
    setEstadoCarga('ok')
  }, [pedir])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Devuelve '' si ha ido bien, o el mensaje de error.
  async function cambiar(cuerpo) {
    const { respuesta } = await pedir('PATCH', cuerpo)
    if (!respuesta?.ok) {
      const json = respuesta ? await respuesta.json().catch(() => ({})) : {}
      return json.error || 'No se ha podido guardar.'
    }
    await cargar()
    return ''
  }

  return { estadoCarga, datos, cambiar }
}
