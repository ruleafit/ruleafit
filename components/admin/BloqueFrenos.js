'use client'

import { useState } from 'react'

const FRENOS = { cobros: 'Cobros nuevos', devoluciones: 'Devoluciones automáticas' }

export default function BloqueFrenos({ paradas, onCambiar }) {
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  async function pulsar(que, parado) {
    const pregunta = parado
      ? `¿Reanudar ${FRENOS[que].toLowerCase()}? Hazlo solo si ya has revisado la causa.`
      : `¿Parar ${FRENOS[que].toLowerCase()}?`
    if (!window.confirm(pregunta)) return
    setTrabajando(true)
    setError(await onCambiar({ accion: parado ? 'reanudar' : 'parar', que }))
    setTrabajando(false)
  }

  return (
    <section className="mt-4 corte-card border border-[#E2E6CF] bg-white p-4">
      <h2 className="text-sm font-bold text-[#1F2400]">Parada segura</h2>
      {paradas.motivo && <p className="mt-1 text-sm text-red-700">Motivo: {paradas.motivo}</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {Object.entries(FRENOS).map(([que, nombre]) => (
          <li key={que} className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#1F2400]">
              {nombre}: <strong>{paradas[que] ? 'EN PAUSA' : 'sin freno'}</strong>
            </span>
            <button
              type="button"
              disabled={trabajando}
              onClick={() => pulsar(que, !!paradas[que])}
              className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] disabled:opacity-60"
            >
              {paradas[que] ? 'Reanudar' : 'Parar'}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[#6B7355]">Quitar un freno no activa los pagos online.</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
