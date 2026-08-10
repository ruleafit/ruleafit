'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function BotonSeguir({ entrenadorId, usuarioActual }) {
  const [siguiendo, setSiguiendo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(false)

  const esCliente = usuarioActual?.user_metadata?.rol === 'cliente'
  const esSuPropioPerfil = usuarioActual?.id === entrenadorId

  useEffect(() => {
    if (!usuarioActual || !esCliente || esSuPropioPerfil) {
      setCargando(false)
      return
    }
    let activo = true
    async function comprobar() {
      const { data } = await supabase
        .from('seguimientos')
        .select('id')
        .eq('seguidor_id', usuarioActual.id)
        .eq('entrenador_id', entrenadorId)
        .maybeSingle()
      if (!activo) return
      if (data) setSiguiendo(true)
      setCargando(false)
    }
    comprobar()
    return () => { activo = false }
  }, [usuarioActual, entrenadorId, esCliente, esSuPropioPerfil])

  if (esSuPropioPerfil) return null

  if (!usuarioActual) {
    return (
      <Link
        href="/login"
        className="inline-block rounded-full border border-[#16231B]/30 px-5 py-2 text-sm font-medium text-[#16231B] transition hover:bg-[#16231B]/5"
      >
        Sigue a este entrenador
      </Link>
    )
  }

  if (!esCliente) return null

  async function alternar() {
    if (procesando || cargando) return
    setProcesando(true)
    setError(false)
    if (siguiendo) {
      const { error: errBorrar } = await supabase
        .from('seguimientos')
        .delete()
        .eq('seguidor_id', usuarioActual.id)
        .eq('entrenador_id', entrenadorId)
      if (errBorrar) setError(true)
      else setSiguiendo(false)
    } else {
      const { error: errInsertar } = await supabase
        .from('seguimientos')
        .insert({ seguidor_id: usuarioActual.id, entrenador_id: entrenadorId })
      if (errInsertar) setError(true)
      else {
        setSiguiendo(true)
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
      }
    }
    setProcesando(false)
  }

  const texto = cargando ? '···' : procesando ? '···' : siguiendo ? 'Siguiendo' : 'Seguir'

  const clase = siguiendo
    ? 'rounded-full border-2 border-[#16231B] px-6 py-2 font-semibold text-[#16231B] transition hover:bg-[#16231B] hover:text-white disabled:opacity-60'
    : 'rounded-full bg-[#B5E600] px-6 py-2 font-semibold text-[#16231B] transition hover:brightness-95 disabled:opacity-60'

  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={alternar} disabled={procesando || cargando} className={clase}>
        {texto}
      </button>
      {error && <p className="text-sm text-[#FF6B3D]">No se pudo actualizar. Inténtalo de nuevo.</p>}
    </div>
  )
}
