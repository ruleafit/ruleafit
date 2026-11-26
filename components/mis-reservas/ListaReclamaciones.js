'use client'

import { useState } from 'react'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import { ESTADOS_INCIDENCIA, MAX_DESCRIPCION, TIPOS_INCIDENCIA, errorDeIncidencia } from '../../lib/pagos/incidencias.ts'
import useReclamaciones from './useReclamaciones'

const COLOR_ESTADO = {
  abierta: 'border-amber-300 bg-amber-50 text-amber-800',
  en_revision: 'border-amber-300 bg-amber-50 text-amber-800',
  resuelta: 'border-[#B5E600] bg-[#EDF5C9] text-[#3D4A00]',
  rechazada: 'border-zinc-300 bg-zinc-100 text-zinc-600',
}

const campo = 'w-full corte-tag border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none'

// Reclamaciones económicas: formulario y casos con su número y estado.
export default function ListaReclamaciones({ reservaInicial = '' }) {
  const r = useReclamaciones()
  const [reservaId, setReservaId] = useState(reservaInicial)
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { ok, texto }

  async function enviar(e) {
    e.preventDefault()
    const fallo = errorDeIncidencia(reservaId, tipo, descripcion)
    if (fallo) {
      setMensaje({ ok: false, texto: fallo })
      return
    }
    setEnviando(true)
    setMensaje(null)
    const res = await r.abrir({ reservaId, tipo, descripcion: descripcion.trim() })
    setEnviando(false)
    if (res.error) {
      setMensaje({ ok: false, texto: res.error })
      return
    }
    setMensaje({ ok: true, texto: `Reclamación enviada. Tu número de caso es ${res.numero}.` })
    setTipo('')
    setDescripcion('')
  }

  if (r.cargando) return <p className="text-sm text-[#6B7355]">Cargando...</p>
  if (r.error) return <p className="text-sm text-red-600">{r.error}</p>

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={enviar} className="flex flex-col gap-3 corte-card border border-[#E2E6CF] bg-white p-5">
        <h2 className="text-base font-bold text-[#1F2400]">Nueva reclamación sobre un pago</h2>
        <p className="text-xs text-[#6B7355]">
          Solo para cobros, cancelaciones y reembolsos. Para cualquier otra cosa, usa Ayuda. No escribas datos de tu
          tarjeta ni contraseñas.
        </p>
        {r.reservas.length === 0 ? (
          <p className="text-sm text-[#6B7355]">Todavía no tienes reservas sobre las que reclamar.</p>
        ) : (
          <>
            <label className="text-sm font-semibold text-[#1F2400]">
              Reserva
              <select value={reservaId} onChange={(e) => setReservaId(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Elige una reserva</option>
                {r.reservas.map((x) => (
                  <option key={x.reserva_id} value={x.reserva_id}>
                    {x.titulo} · {formatearFechaParaMostrar(x.fecha)} {String(x.hora).slice(0, 5)}
                    {x.estado_reserva === 'cancelada' ? ' (cancelada)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#1F2400]">
              Motivo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Elige un motivo</option>
                {Object.entries(TIPOS_INCIDENCIA).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#1F2400]">
              Qué ha ocurrido
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={MAX_DESCRIPCION}
                rows={4}
                className={`${campo} mt-1`}
              />
              <span className="block text-right text-xs font-normal text-[#6B7355]">
                {descripcion.length}/{MAX_DESCRIPCION}
              </span>
            </label>
            <button
              type="submit"
              disabled={enviando}
              className="self-start corte-btn bg-[#B5E600] px-5 py-2 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60"
            >
              {enviando ? 'Enviando...' : 'Enviar reclamación'}
            </button>
          </>
        )}
        {mensaje && (
          <p role="status" className={`text-sm font-medium ${mensaje.ok ? 'text-[#3D4A00]' : 'text-red-600'}`}>
            {mensaje.texto}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-4">
        <h2 className="border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Mis casos</h2>
        {r.casos.length === 0 && <p className="text-sm text-[#6B7355]">No has abierto ninguna reclamación.</p>}
        {r.casos.map((c) => (
          <article key={c.id} className="corte-card border border-[#E2E6CF] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#1F2400]">{c.numero}</span>
              <span className={`corte-tag border px-2.5 py-0.5 text-xs font-bold ${COLOR_ESTADO[c.estado] || ''}`}>
                {ESTADOS_INCIDENCIA[c.estado] || c.estado}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#1F2400]">
              {c.clase_titulo}
              {c.clase_fecha ? ` · ${formatearFechaParaMostrar(c.clase_fecha)}` : ''}
            </p>
            <p className="text-xs text-[#6B7355]">
              {TIPOS_INCIDENCIA[c.tipo] || c.tipo} · abierta el{' '}
              {new Date(c.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#6B7355]">{c.descripcion}</p>
            {c.respuesta && (
              <p className="mt-2 whitespace-pre-wrap corte-card border border-[#B5E600] bg-[#EDF5C9] p-3 text-sm text-[#1F2400]">
                <strong>Respuesta de Ruleafit:</strong> {c.respuesta}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
