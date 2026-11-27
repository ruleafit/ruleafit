'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export async function peticionAdmin(url, opciones = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return fetch(url, {
    ...opciones,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export default function useColaVerificaciones() {
  const [estado, setEstado] = useState('cargando') // cargando | ok | sin-sesion | sin-acceso | error
  const [cola, setCola] = useState({ identidades: [], titulaciones: [], centros: [] })

  const cargar = useCallback(async () => {
    const respuesta = await peticionAdmin('/api/admin/verificaciones')
    if (!respuesta) return setEstado('sin-sesion')
    if (respuesta.status === 403) return setEstado('sin-acceso')
    if (!respuesta.ok) return setEstado('error')
    setCola(await respuesta.json())
    setEstado('ok')
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Devuelve el cuerpo de la respuesta, con `ok`.
  async function resolver(cuerpo) {
    const respuesta = await peticionAdmin('/api/admin/verificaciones', { method: 'PATCH', body: JSON.stringify(cuerpo) })
    const json = (await respuesta?.json().catch(() => null)) || {}
    if (respuesta?.ok) await cargar()
    return { ...json, ok: !!respuesta?.ok }
  }

  return { estado, cola, resolver }
}
