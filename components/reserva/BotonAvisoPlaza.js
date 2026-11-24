'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const botonClass =
  'inline-flex items-center justify-center gap-2 corte-btn border-2 border-[#1F2400] bg-white font-bold text-[#1F2400] px-4 py-2 text-sm ' +
  'hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-70'

// C15 · «Avísame si queda una plaza» para sesiones completas y sin empezar.
//   usuario        null = visitante: abre el panel de identificación (C03) con intención «avisar»
//   alAbrirPanel   callback del visitante
//   retornoAviso   true si acaba de volver tras identificarse para activar el aviso (sigue haciendo falta su confirmación)
// El servidor (activar_aviso_plaza) vuelve a comprobar que la sesión sigue completa, activa y sin empezar.
export default function BotonAvisoPlaza({ clase, usuario, alAbrirPanel, retornoAviso = false, compacto = false }) {
  const [activo, setActivo] = useState(null) // null = comprobando
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    if (!usuario) {
      setActivo(false)
      return
    }
    setActivo(null)
    supabase
      .from('alertas_plaza')
      .select('id')
      .eq('clase_id', clase.id)
      .eq('estado', 'activa')
      .maybeSingle()
      .then(({ data }) => {
        if (vivo) setActivo(!!data)
      })
    return () => {
      vivo = false
    }
  }, [usuario, clase.id])

  async function activar() {
    if (!usuario) {
      alAbrirPanel?.()
      return
    }
    setTrabajando(true)
    setError('')
    const { error: e } = await supabase.rpc('activar_aviso_plaza', { p_clase_id: clase.id })
    setTrabajando(false)
    if (e) setError(e.message)
    else setActivo(true)
  }

  async function desactivar() {
    setTrabajando(true)
    setError('')
    const { error: e } = await supabase.rpc('desactivar_aviso_plaza', { p_clase_id: clase.id })
    setTrabajando(false)
    if (e) setError(e.message)
    else setActivo(false)
  }

  if (activo === null) return null

  if (activo) {
    return (
      <div role="status" className={`mt-2 corte-card border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 ${compacto ? 'text-xs' : 'text-sm'} text-[#3D4A00]`}>
        <p className="flex items-center gap-1.5 font-bold">
          <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
          ¡Aviso activado!
        </p>
        <p className="mt-0.5">Te avisaremos si queda alguna plaza disponible. El aviso no garantiza una reserva.</p>
        {!compacto && (
          <p className="mt-0.5 text-[#6B7355]">
            Si llegas desde un aviso y la sesión está completa, otra persona se ha adelantado: seguirás recibiendo avisos.
          </p>
        )}
        <button
          type="button"
          onClick={desactivar}
          disabled={trabajando}
          className="mt-1 font-semibold underline underline-offset-2 hover:text-[#1F2400] disabled:opacity-60"
        >
          Dejar de recibir avisos
        </button>
        {error && <p className="mt-1 text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mt-2">
      {retornoAviso && usuario && (
        <p role="status" className="mb-2 corte-tag border border-[#B5E600]/60 bg-[#EDF5C9] px-3 py-1.5 text-sm font-medium text-[#3D4A00]">
          Ya has iniciado sesión. Pulsa el botón para activar tu aviso.
        </p>
      )}
      <button type="button" onClick={activar} disabled={trabajando} className={botonClass}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {trabajando ? 'Activando…' : 'Avísame si queda una plaza'}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
