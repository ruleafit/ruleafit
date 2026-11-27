'use client'

import { useState } from 'react'

// Saldos de bonos retenidos por cancelaciones reiteradas (sql/107). Se decide a mano.
export default function RetencionesBonos({ retenciones, onCambiar }) {
  const [error, setError] = useState('')
  if (retenciones.length === 0) return null

  async function actuar(accion, r, pregunta) {
    if (!window.confirm(pregunta)) return
    setError((await onCambiar({ accion, organizador: r.organizador_id })) || '')
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-[#1F2400]">Saldos de bonos retenidos</h2>
      <ul className="mt-2 flex flex-col gap-3">
        {retenciones.map((r) => (
          <li key={r.id} className="corte-card border border-amber-300 bg-amber-50 p-4 text-sm text-[#1F2400]">
            <p className="font-semibold">{r.username ? `@${r.username}` : 'cuenta eliminada'}</p>
            <p>{r.motivo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="corte-tag border border-[#E2E6CF] bg-white px-3 py-1 text-xs font-semibold"
                onClick={() => actuar('levantar_retencion', r, '¿Levantar la retención? El saldo vuelve a liberarse con normalidad.')}>
                Levantar la retención
              </button>
              <button type="button" className="corte-tag border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700"
                onClick={() => actuar('devolver_bonos', r, '¿Anular TODOS sus bonos y devolver a los alumnos la parte no usada? No se puede deshacer.')}>
                Devolver sus bonos
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
