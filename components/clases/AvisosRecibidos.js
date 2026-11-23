'use client'

import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

function fechaHora(iso) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// Avisos que el organizador envió a quien tenía reserva en esta sesión (C18): el texto completo, solo para
// los destinatarios. Si se llega desde la notificación (?aviso=<id>) se resalta el aviso. Solo lectura.
export default function AvisosRecibidos({ claseId, usuario, className = '' }) {
  const [avisos, setAvisos] = useState([])
  const [resaltado, setResaltado] = useState('')
  const raiz = useRef(null)

  useEffect(() => {
    if (!usuario || !claseId) {
      setAvisos([])
      return undefined
    }
    let vivo = true
    supabase.rpc('avisos_sesion_participante', { p_clase_id: claseId }).then(({ data }) => {
      if (vivo) setAvisos(Array.isArray(data) ? data : [])
    })
    return () => {
      vivo = false
    }
  }, [usuario, claseId])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('aviso')
    if (!id || avisos.length === 0) return undefined
    setResaltado(id)
    const t = setTimeout(() => raiz.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    return () => clearTimeout(t)
  }, [avisos])

  if (avisos.length === 0) return null

  return (
    <div ref={raiz} className={className}>
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[#1F2400]">
        <Megaphone className="h-4 w-4 text-[#3D4A00]" strokeWidth={2} />
        Avisos del organizador
      </p>
      <ul className="flex flex-col gap-2">
        {avisos.map((a) => (
          <li
            key={a.aviso_id}
            className={`corte-card border p-3 ${a.aviso_id === resaltado ? 'border-[#B5E600] bg-[#EDF5C9]' : 'border-[#E2E6CF] bg-[#FBFAF3]'}`}
          >
            <p className="text-[11px] text-[#6B7355]">
              @{a.organizador} · {fechaHora(a.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#1F2400]">{a.mensaje}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[#6B7355]">Son avisos informativos. Los cambios de horario, lugar o las cancelaciones se confirman en la propia sesión.</p>
    </div>
  )
}
