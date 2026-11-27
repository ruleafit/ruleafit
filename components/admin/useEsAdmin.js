'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Una sola pregunta al servidor por usuario mientras la web esté abierta. Es solo
// para enseñar el acceso: cada página de /admin vuelve a comprobar el permiso.
const respuestas = new Map()

async function preguntar() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return false
  const respuesta = await fetch('/api/admin/resumen', { headers: { Authorization: `Bearer ${token}` } })
  if (!respuesta.ok) throw new Error('sin respuesta')
  return (await respuesta.json()).admin === true
}

export default function useEsAdmin(usuarioId) {
  const [admin, setAdmin] = useState({ id: null, valor: false })

  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false
    if (!respuestas.has(usuarioId)) {
      respuestas.set(
        usuarioId,
        preguntar().catch(() => {
          respuestas.delete(usuarioId)
          return false
        })
      )
    }
    respuestas.get(usuarioId).then((valor) => {
      if (!cancelado) setAdmin({ id: usuarioId, valor })
    })
    return () => {
      cancelado = true
    }
  }, [usuarioId])

  return !!usuarioId && admin.id === usuarioId && admin.valor
}
