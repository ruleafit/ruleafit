'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function CampanaNotificaciones({ usuarioActual }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState(false)
  const [items, setItems] = useState([])
  const [noLeidas, setNoLeidas] = useState(0)
  const contenedorRef = useRef(null)

  // Carga solo las no leidas.
  async function cargar() {
    try {
      const { data } = await supabase
        .from('notificaciones_historial')
        .select('id, tipo, titulo, cuerpo, url, leido, created_at')
        .eq('usuario_id', usuarioActual.id)
        .eq('leido', false)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        setItems(data)
        setNoLeidas(data.length)
      }
    } catch (e) {
      // silencioso: si falla, no rompemos el menu
    }
  }

  const abiertaRef = useRef(false)
  useEffect(() => {
    abiertaRef.current = abierta
  }, [abierta])

  // Al montar y cada 60s (pausado mientras el desplegable esta abierto).
  useEffect(() => {
    cargar()
    const intervalo = setInterval(() => {
      if (!abiertaRef.current) cargar()
    }, 60000)
    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioActual.id])

  function cerrar() {
    setAbierta(false)
    setItems([])
  }

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function fuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        cerrar()
      }
    }
    if (abierta) document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta])

  // Al abrir: marcar todas como leidas (la lista se mantiene visible hasta cerrar).
  // Al cerrar: vaciar la lista para que la proxima apertura solo traiga lo nuevo.
  async function alternar() {
    if (abierta) {
      cerrar()
      return
    }
    setAbierta(true)
    if (noLeidas > 0) {
      setNoLeidas(0)
      try {
        await supabase
          .from('notificaciones_historial')
          .update({ leido: true })
          .eq('usuario_id', usuarioActual.id)
          .eq('leido', false)
      } catch (e) {
        // silencioso
      }
    }
  }

  function irA(url) {
    setAbierta(false)
    if (url) router.push(url)
  }

  function irAlHistorial() {
    setAbierta(false)
    router.push('/cuenta#notificaciones', { scroll: false })
  }

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

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={alternar}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-[#162318] transition-colors hover:bg-zinc-50"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {noLeidas > 0 && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#E5533D] ring-2 ring-white" />
        )}
      </button>

      {abierta && (
        <div className="fixed left-3 right-3 top-16 w-auto md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg z-[2100]">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-[#3D4A00]">Notificaciones</p>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-[#162318]/60">No tienes notificaciones nuevas ahora mismo</p>
              <button
                type="button"
                onClick={irAlHistorial}
                className="mt-2 text-sm font-medium text-[#3D4A00] underline underline-offset-2"
              >
                Ver historial de notificaciones
              </button>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => irA(n.url)}
                    className="flex w-full flex-col gap-0.5 border-b border-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-[#162318]">{n.titulo}</span>
                    <span className="text-xs text-[#162318]/70">{n.cuerpo}</span>
                    <span className="text-[11px] text-[#162318]/40">{tiempoRelativo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
