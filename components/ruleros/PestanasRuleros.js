'use client'

import { Star, UserCheck } from 'lucide-react'

const base =
  'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap corte-btn border-2 px-2 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 sm:flex-none sm:px-6'
const activa = `${base} border-[#B5E600] bg-[#B5E600] text-[#1F2400]`
const inactiva = `${base} border-[#B5E600] bg-white text-[#3D4A00] hover:bg-[#F5F7E8]`

// Pestañas "Favoritos" | "Seguidos". Al entrar siempre se arranca en
// Favoritos (el estado inicial vive en la página).
export default function PestanasRuleros({ pestana, setPestana, totalFavoritos, totalSeguidos }) {
  return (
    <div role="tablist" aria-label="Mis ruleros" className="mb-6 flex gap-2 sm:gap-3">
      <button
        type="button"
        role="tab"
        id="pestana-favoritos"
        aria-selected={pestana === 'favoritos'}
        aria-controls="panel-ruleros"
        onClick={() => setPestana('favoritos')}
        className={pestana === 'favoritos' ? activa : inactiva}
      >
        <Star className="h-4 w-4" strokeWidth={1.75} fill={pestana === 'favoritos' ? 'currentColor' : 'none'} />
        Favoritos ({totalFavoritos})
      </button>
      <button
        type="button"
        role="tab"
        id="pestana-seguidos"
        aria-selected={pestana === 'seguidos'}
        aria-controls="panel-ruleros"
        onClick={() => setPestana('seguidos')}
        className={pestana === 'seguidos' ? activa : inactiva}
      >
        <UserCheck className="h-4 w-4" strokeWidth={1.75} />
        Seguidos ({totalSeguidos})
      </button>
    </div>
  )
}
