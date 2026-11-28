'use client'

import { useState } from 'react'

const BASE = 'corte-tag border px-3 py-1.5 text-xs font-semibold disabled:opacity-60'
const SECUNDARIO = `${BASE} border-[#E2E6CF] text-[#3D4A00] hover:border-[#B5E600]`

// Acción con confirmación dentro de la página (window.confirm no aparece en algunos navegadores).
export default function BotonConfirmar({ texto, pregunta, onConfirmar, principal = false }) {
  const [abierto, setAbierto] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const estilo = principal ? `${BASE} border-[#B5E600] bg-[#B5E600] text-[#1F2400]` : SECUNDARIO

  async function confirmar() {
    setTrabajando(true)
    setError('')
    const fallo = await onConfirmar()
    setTrabajando(false)
    if (fallo) setError(fallo)
    else setAbierto(false)
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={estilo}>
        {texto}
      </button>
    )
  }
  return (
    <div role="group" aria-label={texto} className="w-full corte-card border border-[#B5E600] bg-[#FBFAF3] p-3">
      <p className="text-sm text-[#1F2400]">{pregunta}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={trabajando} onClick={confirmar} className={`${BASE} border-[#B5E600] bg-[#B5E600] text-[#1F2400]`}>
          {trabajando ? 'Guardando...' : 'Sí, confirmar'}
        </button>
        <button type="button" disabled={trabajando} onClick={() => setAbierto(false)} className={SECUNDARIO}>
          Volver
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
