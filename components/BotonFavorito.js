'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import PanelIdentificacion from './reserva/PanelIdentificacion'

// "Añadir a favoritos": lista PRIVADA del usuario (tabla public.favoritos,
// sql/078), independiente de "Seguir" (BotonSeguir). El favorito no recibe
// aviso ni puede saber quién lo tiene guardado.
// username (C25): para visitantes sin sesión, abre el panel de identificación y, tras entrar, vuelve a este perfil.
export default function BotonFavorito({ favoritoId, usuarioActual, username }) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [esFavorito, setEsFavorito] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(false)

  const esSuPropioPerfil = usuarioActual?.id === favoritoId

  useEffect(() => {
    if (!usuarioActual || esSuPropioPerfil) {
      setCargando(false)
      return
    }
    let activo = true
    async function comprobar() {
      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('usuario_id', usuarioActual.id)
        .eq('favorito_id', favoritoId)
        .maybeSingle()
      if (!activo) return
      setEsFavorito(!!data)
      setCargando(false)
    }
    comprobar()
    return () => { activo = false }
  }, [usuarioActual, favoritoId, esSuPropioPerfil])

  if (esSuPropioPerfil) return null

  if (!usuarioActual && username) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPanelAbierto(true)}
          className="inline-flex items-center gap-2 corte-btn border-2 border-[#B5E600] bg-white px-5 py-2 text-sm font-semibold text-[#3D4A00] transition hover:bg-[#F5F7E8]"
        >
          <Star className="h-4 w-4" strokeWidth={1.75} />
          Añadir a favoritos
        </button>
        {panelAbierto && <PanelIdentificacion perfil={{ username }} intencion="favorito" onCerrar={() => setPanelAbierto(false)} />}
      </div>
    )
  }

  if (!usuarioActual) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 corte-btn border-2 border-[#B5E600] bg-white px-5 py-2 text-sm font-semibold text-[#3D4A00] transition hover:bg-[#F5F7E8]"
      >
        <Star className="h-4 w-4" strokeWidth={1.75} />
        Añadir a favoritos
      </Link>
    )
  }

  async function alternar() {
    if (procesando || cargando) return
    setProcesando(true)
    setError(false)
    if (esFavorito) {
      const { error: errBorrar } = await supabase
        .from('favoritos')
        .delete()
        .eq('usuario_id', usuarioActual.id)
        .eq('favorito_id', favoritoId)
      if (errBorrar) setError(true)
      else setEsFavorito(false)
    } else {
      const { error: errInsertar } = await supabase
        .from('favoritos')
        .insert({ usuario_id: usuarioActual.id, favorito_id: favoritoId })
      if (errInsertar) setError(true)
      else setEsFavorito(true)
    }
    setProcesando(false)
  }

  const clase = esFavorito
    ? 'inline-flex items-center gap-2 corte-btn border-2 border-[#B5E600] bg-[#B5E600] px-5 py-2 text-sm font-semibold text-[#1F2400] transition hover:brightness-95 disabled:opacity-60'
    : 'inline-flex items-center gap-2 corte-btn border-2 border-[#B5E600] bg-white px-5 py-2 text-sm font-semibold text-[#3D4A00] transition hover:bg-[#F5F7E8] disabled:opacity-60'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={procesando || cargando}
        aria-pressed={esFavorito}
        className={clase}
      >
        <Star className="h-4 w-4" strokeWidth={1.75} fill={esFavorito ? 'currentColor' : 'none'} />
        {esFavorito ? 'En favoritos' : 'Añadir a favoritos'}
      </button>
      {error && <p className="text-sm text-[#FF6B3D]">No se pudo actualizar. Inténtalo de nuevo.</p>}
    </div>
  )
}
