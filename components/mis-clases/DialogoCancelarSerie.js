'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const TEXTOS = {
  solo_esta: 'Solo esta sesión',
  esta_y_siguientes: 'Esta y las siguientes',
  toda_futura: 'Toda la serie futura',
}

// Confirmación para cancelar sesiones de una serie: el organizador elige el alcance y ve cuántas
// sesiones se cancelarán y cuántas tienen reservas ANTES de confirmar. La cancelación la hace la
// función cancelar_serie, que usa la cancelación de sesión de siempre para cada una.
//   clase     sesión de referencia (la elegida)
//   alcances  alcances que se ofrecen
export default function DialogoCancelarSerie({ clase, alcances, m, onResultado, onCerrar }) {
  const [alcance, setAlcance] = useState(alcances[0])
  const [previa, setPrevia] = useState(null)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setPrevia(null)
    setError('')
    supabase
      .rpc('previsualizar_cancelacion_serie', { p_clase_id: clase.clase_id, p_alcance: alcance })
      .then(({ data, error: e }) => {
        if (cancelado) return
        if (e) setError(e.message)
        else setPrevia(data)
      })
    return () => {
      cancelado = true
    }
  }, [clase.clase_id, alcance])

  async function confirmar() {
    setProcesando(true)
    setError('')
    const { data, error: e } = await supabase.rpc('cancelar_serie', { p_clase_id: clase.clase_id, p_alcance: alcance })
    setProcesando(false)
    if (e) {
      setError(e.message)
      return
    }
    const n = data?.sesiones_canceladas ?? 0
    const r = data?.reservas_canceladas ?? 0
    onResultado(
      `${n} ${n === 1 ? 'sesión cancelada' : 'sesiones canceladas'}. ` +
        (r === 0 ? 'No tenían reservas activas.' : `${r === 1 ? 'Se ha cancelado 1 reserva' : `Se han cancelado ${r} reservas`} y se ha avisado a las personas afectadas.`)
    )
    m.recargar()
  }

  return (
    <div className="mt-3 corte-card border border-red-200 bg-red-50/50 p-3" role="group" aria-label="Cancelar sesiones de la serie">
      {alcances.length > 1 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {alcances.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2 text-sm text-[#1F2400]">
              <input type="radio" name={`alcance-${clase.clase_id}`} checked={alcance === a} onChange={() => setAlcance(a)} className="accent-red-600" />
              {TEXTOS[a]}
            </label>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-sm [overflow-wrap:anywhere] font-medium text-red-700">{error}</p>}
      {!error && !previa && <p className="text-sm text-[#6B7355]">Calculando…</p>}
      {previa && (
        <p className="text-sm text-[#1F2400]">
          Se {previa.sesiones === 1 ? 'cancelará 1 sesión' : `cancelarán ${previa.sesiones} sesiones`}
          {previa.con_reservas > 0
            ? `; ${previa.con_reservas === 1 ? '1 tiene reservas' : `${previa.con_reservas} tienen reservas`} (${previa.reservas} ${previa.reservas === 1 ? 'reserva' : 'reservas'} en total) y se avisará a esas personas.`
            : '; ninguna tiene reservas.'}{' '}
          <span className="text-[#6B7355]">Las sesiones pasadas no se tocan. No se puede deshacer.</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="corte-tag border border-[#E2E6CF] bg-white px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:bg-[#EDF5C9]"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={procesando || !previa || previa.sesiones === 0}
          className="corte-tag bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {procesando ? 'Cancelando…' : previa ? `Cancelar ${previa.sesiones} ${previa.sesiones === 1 ? 'sesión' : 'sesiones'}` : 'Cancelar'}
        </button>
      </div>
    </div>
  )
}
