'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearFechaParaMostrar as fecha } from '../../lib/formatoFecha'
import { ESTADOS_LINEA } from '../../lib/pagos/liquidaciones.ts'
import BotonConfirmar from './BotonConfirmar'

// Una transferencia: ver los datos (el IBAN solo se pide al pulsar) y anotar si se ha hecho o se anula.
export default function LineaLiquidacion({ linea, onMarcar }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const importe = formatearEuros(linea.importe_centimos)
  const quien = linea.username ? `@${linea.username}` : 'cuenta eliminada'

  async function verDatos() {
    setError('')
    const { data } = await supabase.auth.getSession()
    const respuesta = await fetch('/api/admin/liquidaciones', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ linea: linea.id }),
    }).catch(() => null)
    const json = respuesta ? await respuesta.json().catch(() => ({})) : {}
    if (!respuesta?.ok) setError(json.error || 'No se han podido leer los datos.')
    else setDatos(json)
  }

  return (
    <li className="corte-card border border-[#E2E6CF] bg-white p-3 text-sm text-[#1F2400]">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold">
          {quien} · pago {fecha(linea.fecha_pago)}
        </span>
        <strong>{importe}</strong>
      </div>
      <p className="text-xs text-[#6B7355]">
        {ESTADOS_LINEA[linea.estado]} · cuenta terminada en {linea.iban_ultimos4}
      </p>
      {linea.estado === 'pendiente' && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={datos ? () => setDatos(null) : verDatos}
            className="corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]"
          >
            {datos ? 'Ocultar datos' : 'Ver datos de la transferencia'}
          </button>
          <BotonConfirmar
            texto="Marcar transferida"
            pregunta={`¿Ya has enviado ${importe} a ${quien}? Se le avisará.`}
            onConfirmar={() => onMarcar('pagada')}
          />
          <BotonConfirmar
            texto="Anular"
            pregunta={`¿Anular? ${importe} vuelve al saldo de ${quien}. Hazlo solo si la transferencia no se ha enviado o el banco la ha devuelto.`}
            onConfirmar={() => onMarcar('anulada')}
          />
        </div>
      )}
      {datos && linea.estado === 'pendiente' && (
        <dl className="mt-2 corte-card border border-[#B5E600] bg-[#EDF5C9] p-3 text-sm">
          <div>Titular: <strong>{datos.titular}</strong></div>
          <div>IBAN: <strong className="break-all">{datos.iban}</strong></div>
          <div>Importe: <strong>{formatearEuros(datos.importe_centimos)}</strong></div>
          <div>Concepto: <strong>{datos.concepto}</strong></div>
          {datos.iban_cambiado && (
            <div className="mt-1 font-bold text-red-700">El IBAN ha cambiado desde el cierre. Compruébalo antes de enviar.</div>
          )}
        </dl>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  )
}
