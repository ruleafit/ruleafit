'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function HistorialNotificaciones({ usuarioActual }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const { data } = await supabase
          .from('notificaciones_historial')
          .select('id, tipo, titulo, cuerpo, url, leido, created_at')
          .eq('usuario_id', usuarioActual.id)
          .order('created_at', { ascending: false })
          .limit(10)
        if (vivo && data) setItems(data)
      } catch (e) {
        // silencioso
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [usuarioActual.id])

  function tiempoRelativo(fecha) {
    const d = new Date(fecha)
    const ahora = new Date()
    const min = Math.floor((ahora - d) / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return 'hace ' + min + ' min'
    const h = Math.floor(min / 60)
    if (h < 24) return 'hace ' + h + ' h'
    const dias = Math.floor(h / 24)
    return 'hace ' + dias + ' d'
  }

  if (cargando) {
    return <p className="text-sm text-[#162318]/60">Cargando historial...</p>
  }

  if (items.length === 0) {
    return <p className="text-sm text-[#162318]/60">Aún no tienes notificaciones.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
      {items.map((n) => (
        <li key={n.id}>
          <button
            onClick={() => { if (n.url) router.push(n.url) }}
            className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
          >
            <span className="text-sm font-medium text-[#162318]">{n.titulo}</span>
            <span className="text-xs text-[#162318]/70">{n.cuerpo}</span>
            <span className="text-[11px] text-[#162318]/40">{tiempoRelativo(n.created_at)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
