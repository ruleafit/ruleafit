'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Contenido del desplegable «Ruleros bloqueados» de Mi cuenta: lista de usuarios
// bloqueados (tabla bloqueos) con opción de desbloquear. Desbloquear devuelve la
// visibilidad del perfil y de las sesiones, pero NO restaura reservas canceladas ni
// deshace reembolsos.
export default function UsuariosBloqueados({ usuario }) {
  const [bloqueados, setBloqueados] = useState([])
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const { data: filas, error: errorLectura } = await supabase
        .from('bloqueos')
        .select('bloqueado_id')
        .eq('bloqueador_id', usuario.id)
      if (cancelado) return
      if (errorLectura || !filas || filas.length === 0) {
        if (errorLectura) setError('No hemos podido cargar tus bloqueos.')
        setCargado(true)
        return
      }

      const ids = filas.map((f) => f.bloqueado_id)
      const { data: perfiles } = await supabase.from('perfiles').select('id, username').in('id', ids)
      if (cancelado) return
      const nombres = new Map((perfiles || []).map((p) => [p.id, p.username]))
      setBloqueados(ids.map((id) => ({ id, username: nombres.get(id) || 'usuario' })))
      setCargado(true)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuario.id])

  async function desbloquear(id) {
    setError('')
    const { error: errorBorrado } = await supabase
      .from('bloqueos')
      .delete()
      .eq('bloqueador_id', usuario.id)
      .eq('bloqueado_id', id)
    if (errorBorrado) {
      setError('No se pudo desbloquear. Inténtalo de nuevo.')
      return
    }
    setBloqueados((prev) => prev.filter((b) => b.id !== id))
  }

  if (!cargado) {
    return <p className="text-sm text-[#6B7355]">Cargando...</p>
  }

  return (
    <div>
      {bloqueados.length === 0 ? (
        <p className="text-sm text-[#6B7355]">No tienes ruleros bloqueados</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-[#6B7355]">
            No ves sus sesiones y ellos no ven tus sesiones ni tu perfil. Puedes desbloquearlos cuando quieras.
          </p>
          <ul className="flex flex-col gap-2">
            {bloqueados.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[#1F2400]">@{b.username}</span>
                <button
                  type="button"
                  onClick={() => desbloquear(b.id)}
                  className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] hover:bg-[#EDF5C9]"
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
