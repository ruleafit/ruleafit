'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { plazoCancelacion } from '../../lib/plazoCancelacion'
import { tipoReserva } from '../mis-reservas/datos'

// «Cancelar reserva» con confirmación dentro de la página: window.confirm no aparece en algunos navegadores (o se
// puede bloquear) y entonces el botón parecía no hacer nada. Las reglas las aplica cancelar_reserva() en el servidor.
// reserva = { id, bono_cliente_id }; onCancelada(respuesta) se llama cuando el servidor la ha cancelado.
export default function CancelarReserva({ reserva, clase, onCancelada }) {
  const [pregunta, setPregunta] = useState('') // con texto = pidiendo confirmación
  const [abriendo, setAbriendo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState('')

  async function abrir() {
    setError('')
    setAbriendo(true)
    // Con menos de 2 h se puede cancelar igualmente, pero sin devolución (o con la sesión del bono consumida), salvo
    // que haya un cambio de la sesión sin responder (sql/100): entonces no tiene coste.
    const tipo = tipoReserva(reserva, clase)
    let tardia = tipo !== 'gratuita' && plazoCancelacion(clase).estado === 'cerrado'
    if (tardia) {
      const { data } = await supabase.rpc('mis_reprogramaciones_pendientes')
      if (Array.isArray(data) && data.some((x) => x.reserva_id === reserva.id)) tardia = false
    }
    let texto = `¿Seguro que quieres cancelar tu reserva de ${clase.titulo}? Esta acción no se puede deshacer.`
    if (tardia) {
      const consecuencia = tipo === 'bono' ? 'la sesión de tu bono se considerará consumida' : 'no recibirás la devolución del importe pagado'
      texto = `¿Seguro que quieres cancelar? Tu plaza quedará libre para otra persona, pero ${consecuencia}.`
    }
    setPregunta(texto)
    setAbriendo(false)
  }

  async function confirmar() {
    setCancelando(true)
    setError('')
    const { data, error: fallo } = await supabase.rpc('cancelar_reserva', { p_reserva_id: reserva.id })
    setCancelando(false)
    if (fallo) {
      setError(fallo.message || 'No se ha podido cancelar. Inténtalo de nuevo.')
      return
    }
    setPregunta('')
    onCancelada(data)
  }

  return (
    <>
      {!pregunta && (
        <button
          type="button"
          onClick={abrir}
          disabled={abriendo}
          className="corte-tag border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar reserva
        </button>
      )}
      {pregunta && (
        <div role="group" aria-label="Confirmar cancelación" className="w-full corte-card border border-red-200 bg-red-50 p-3 text-left">
          <p className="text-sm text-[#1F2400]">{pregunta}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmar}
              disabled={cancelando}
              className="corte-tag bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPregunta('')
                setError('')
              }}
              disabled={cancelando}
              className="corte-tag border border-[#3D4A00]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#3D4A00] disabled:opacity-60"
            >
              Volver
            </button>
          </div>
        </div>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </>
  )
}
