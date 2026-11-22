'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const enfoqueClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

// Ajuste de «Tu perfil»: «Mostrar mi @ a otros participantes». DESACTIVADO por defecto
// (sin fila guardada = desactivado): nadie aparece con su @ hasta que lo activa él mismo. Se guarda en public.perfil_privacidad (sql/085), solo
// legible y editable por su dueño, y se aplica en el servidor a todas sus reservas,
// presentes y futuras. El organizador siempre ve el @ real.
export default function PrivacidadParticipante({ usuario }) {
  const [mostrar, setMostrar] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const { data, error: err } = await supabase
        .from('perfil_privacidad')
        .select('mostrar_arroba_participantes')
        .eq('usuario_id', usuario.id)
        .maybeSingle()
      if (cancelado) return
      if (err) setError('No hemos podido cargar este ajuste.')
      else if (data) setMostrar(data.mostrar_arroba_participantes)
      setCargado(true)
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuario.id])

  async function cambiar() {
    if (guardando || !cargado) return
    const nuevo = !mostrar
    setGuardando(true)
    setError('')
    setMostrar(nuevo)
    const { error: err } = await supabase
      .from('perfil_privacidad')
      .upsert({ usuario_id: usuario.id, mostrar_arroba_participantes: nuevo }, { onConflict: 'usuario_id' })
    if (err) {
      setMostrar(!nuevo)
      setError('No se ha podido guardar. Inténtalo de nuevo.')
    }
    setGuardando(false)
  }

  return (
    <div className="mb-8 border-t border-[#E2E6CF] pt-6">
      <div className="flex items-center justify-between gap-4">
        <span id="privacidad-arroba" className="text-sm font-semibold text-[#162318]">
          Mostrar mi @ a otros participantes
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={mostrar}
          aria-labelledby="privacidad-arroba"
          disabled={!cargado || guardando}
          onClick={cambiar}
          className={
            (mostrar ? 'bg-[#B5E600]' : 'bg-zinc-300') +
            ` relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${enfoqueClass}`
          }
        >
          <span
            className={
              (mostrar ? 'translate-x-6' : 'translate-x-1') + ' inline-block h-4 w-4 rounded-full bg-white transition'
            }
          />
        </button>
      </div>
      <p className="mt-2 text-sm text-[#6B7355]">
        Si lo activas, los demás participantes verán tu @ y podrán visitar tu perfil en las sesiones que reserves. Si no,
        aparecerás como Usuario anónimo. El organizador siempre podrá ver tu usuario.
      </p>
      {error && <p className="mt-2 text-sm text-[#B85E60]">{error}</p>}
    </div>
  )
}
