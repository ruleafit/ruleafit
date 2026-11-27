'use client'

import { useState } from 'react'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { ESTADOS_INCIDENCIA, TIPOS_INCIDENCIA, estaCerrada, puedeDevolver } from '../../lib/pagos/incidencias.ts'

export default function TarjetaCasoAdmin({ caso, onCambiar }) {
  const [respuesta, setRespuesta] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(datos) {
    setTrabajando(true)
    setError('')
    const fallo = await onCambiar({ id: caso.id, respuesta: respuesta.trim() || null, ...datos })
    setTrabajando(false)
    if (fallo) setError(fallo)
    else setRespuesta('')
  }

  const cambiar = (estado) => enviar({ estado })

  function devolver() {
    if (!respuesta.trim()) {
      setError('Para cerrar un caso hay que escribir una respuesta.')
      return
    }
    const pregunta = `¿Devolver ${formatearEuros(caso.cobros.importe_centimos)} y cerrar el caso ${caso.numero}? Si la sesión no ha empezado, se cancela también la reserva. Si es un bono, se devuelve la parte no usada y se anula. No se puede deshacer.`
    if (window.confirm(pregunta)) enviar({ accion: 'devolver' })
  }

  return (
    <li className="corte-card border border-[#E2E6CF] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#1F2400]">
          {caso.numero} · {ESTADOS_INCIDENCIA[caso.estado]}
        </span>
        <span className="text-xs text-[#6B7355]">{new Date(caso.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
      </div>
      <p className="mt-2 text-sm text-[#1F2400]">
        {caso.username ? `@${caso.username}` : 'cuenta eliminada'} · {caso.clase_titulo} ({caso.clase_fecha || 'sin fecha'})
      </p>
      <p className="text-sm text-[#6B7355]">{TIPOS_INCIDENCIA[caso.tipo]}</p>
      <p className="text-sm text-[#6B7355]">
        {caso.cobros
          ? `Cobro ${caso.cobros.pedido_redsys}: ${formatearEuros(caso.cobros.importe_centimos)}, ${caso.cobros.estado}`
          : 'Sin cobro asociado'}
      </p>
      <p className="mt-2 whitespace-pre-wrap corte-card border border-[#E2E6CF] bg-[#FBFAF3] p-3 text-sm text-[#1F2400]">{caso.descripcion}</p>
      {caso.respuesta && <p className="mt-2 whitespace-pre-wrap text-sm text-[#3D4A00]">Respuesta enviada: {caso.respuesta}</p>}
      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Respuesta para la persona (obligatoria para cerrar el caso)"
        className="mt-3 w-full corte-tag border border-[#E2E6CF] px-3 py-2 text-sm text-[#1F2400]"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(ESTADOS_INCIDENCIA).map(([estado, texto]) => (
          <button
            key={estado}
            type="button"
            disabled={trabajando || (estado === caso.estado && !respuesta.trim())}
            onClick={() => cambiar(estado)}
            className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] hover:bg-[#EDF5C9] disabled:opacity-50"
          >
            {estado === caso.estado ? `Responder (${texto})` : `Pasar a: ${texto}`}
          </button>
        ))}
        {!estaCerrada(caso.estado) && puedeDevolver(caso.cobros?.estado) && (
          <button
            type="button"
            disabled={trabajando}
            onClick={devolver}
            className="corte-tag border border-red-300 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Devolver y cerrar
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  )
}
