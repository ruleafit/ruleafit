'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Send, History, RotateCw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'

export const MAX_CARACTERES_AVISO = 300

function fechaHora(iso) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// Panel para escribir un aviso informativo a quienes tienen reserva activa en UNA sesión (C18).
// No es un chat: sin respuestas. Los límites (3 avisos, 300 caracteres, solo antes de empezar, solo el
// organizador) los aplica el servidor (enviar_aviso_participantes); aquí solo se reflejan.
//   clase = { clase_id, clase_titulo, clase_fecha, clase_hora }
export default function PanelAvisosParticipantes({ clase, onCerrar }) {
  const [info, setInfo] = useState(null)
  const [username, setUsername] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('')

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('avisos_sesion_organizador', { p_clase_id: clase.clase_id })
    if (e) {
      setError(e.message)
      return null
    }
    setInfo(data)
    return data
  }, [clase.clase_id])

  useEffect(() => {
    cargar()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return
      const { data: p } = await supabase.from('perfiles').select('username').eq('id', data.user.id).maybeSingle()
      setUsername(p?.username || '')
    })
  }, [cargar])

  const largo = texto.trim().length
  const demasiado = largo > MAX_CARACTERES_AVISO
  const n = info?.destinatarios_actuales ?? 0
  const bloqueo = !info
    ? 'Cargando…'
    : !info.sesion_activa
      ? 'La sesión ya ha comenzado o está cancelada.'
      : info.restantes <= 0
        ? 'Has alcanzado el máximo de 3 avisos para esta sesión.'
        : n === 0
          ? 'Todavía no hay participantes con reserva activa.'
          : ''
  const puedeEnviar = !bloqueo && largo > 0 && !demasiado && !enviando

  async function enviar() {
    if (!puedeEnviar) return
    setError('')
    setResultado('')
    // El número de destinatarios se recalcula justo antes de confirmar.
    const fresco = await cargar()
    if (!fresco) return
    if (!fresco.puede_enviar) {
      setError('Ya no se puede enviar el aviso: revisa el estado de la sesión y los participantes.')
      return
    }
    const ok = window.confirm(
      `Se enviará este aviso ahora a ${fresco.destinatarios_actuales} ${fresco.destinatarios_actuales === 1 ? 'participante' : 'participantes'}. Después no se podrá modificar. ¿Continuar?`
    )
    if (!ok) return
    setEnviando(true)
    const { data, error: e } = await supabase.rpc('enviar_aviso_participantes', { p_clase_id: clase.clase_id, p_mensaje: texto })
    setEnviando(false)
    if (e) {
      setError(e.message)
      await cargar()
      return
    }
    setResultado(
      data?.repetido
        ? 'Ese aviso ya se había enviado hace un momento: no se ha duplicado.'
        : `Aviso enviado a ${data.destinatarios} ${data.destinatarios === 1 ? 'participante' : 'participantes'}.`
    )
    setTexto('')
    await cargar()
  }

  async function reintentar(avisoId) {
    setError('')
    const { data, error: e } = await supabase.rpc('reintentar_aviso', { p_aviso_id: avisoId })
    if (e) setError(e.message)
    else setResultado(data.reenviados > 0 ? `Reenviado a ${data.reenviados} ${data.reenviados === 1 ? 'participante' : 'participantes'}.` : 'No había nada pendiente.')
    await cargar()
  }

  const enviados = info?.enviados || []

  return (
    <div className="mt-3 corte-card border border-[#B5E600] bg-[#FBFAF3] p-4" role="group" aria-label="Enviar aviso a participantes">
      <div className="flex items-start gap-2">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1F2400]">{clase.clase_titulo}</p>
          <p className="text-xs text-[#6B7355]">
            {formatearFechaParaMostrar(clase.clase_fecha)} · {String(clase.clase_hora).slice(0, 5)} ·{' '}
            {info ? `${n} ${n === 1 ? 'participante con reserva activa' : 'participantes con reserva activa'}` : 'cargando…'}
          </p>
        </div>
        {onCerrar && (
          <button type="button" onClick={onCerrar} className="text-xs font-semibold text-[#6B7355] hover:underline">
            Cerrar
          </button>
        )}
      </div>

      <label htmlFor={`aviso-${clase.clase_id}`} className="mt-3 block text-sm font-medium text-[#1F2400]">
        Mensaje para los participantes
      </label>
      <textarea
        id={`aviso-${clase.clase_id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        disabled={!!bloqueo && !!info}
        placeholder="Ej.: Recordad traer esterilla y agua."
        className="mt-1 block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600] disabled:bg-zinc-50"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-[#6B7355]">Solo informativo: para cambiar fecha, hora, ubicación o precio, o cancelar, usa las opciones de la sesión.</span>
        <span className={`ml-3 shrink-0 font-semibold ${demasiado ? 'text-red-600' : 'text-[#6B7355]'}`}>
          {largo}/{MAX_CARACTERES_AVISO}
        </span>
      </div>

      {largo > 0 && (
        <div className="mt-3 corte-card border border-[#E2E6CF] bg-white p-3" aria-label="Vista previa">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7355]">Así lo verán</p>
          <p className="mt-1 text-sm font-medium text-[#162318]">Aviso de @{username || 'tu-usuario'}</p>
          <p className="whitespace-pre-wrap break-words text-xs text-[#162318]/80">
            «{clase.clase_titulo}» · {formatearFechaParaMostrar(clase.clase_fecha).slice(0, 5)} {String(clase.clase_hora).slice(0, 5)} — {texto.trim()}
          </p>
        </div>
      )}

      {bloqueo && info && <p className="mt-3 text-sm font-medium text-amber-800">{bloqueo}</p>}
      {error && <p className="mt-3 text-sm font-medium text-red-700 [overflow-wrap:anywhere]">{error}</p>}
      {resultado && (
        <p role="status" className="mt-3 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-medium text-[#3D4A00]">
          {resultado}
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={!puedeEnviar}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 corte-btn bg-[#B5E600] px-4 py-2.5 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Send className="h-4 w-4" strokeWidth={2} />
        {enviando ? 'Enviando…' : n > 0 ? `Enviar aviso a ${n} ${n === 1 ? 'participante' : 'participantes'}` : 'Enviar aviso a participantes'}
      </button>

      <div className="mt-5 border-t border-[#E2E6CF] pt-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1F2400]">
          <History className="h-4 w-4 text-[#3D4A00]" strokeWidth={2} />
          Avisos enviados
        </p>
        <p className="mt-0.5 text-xs text-[#6B7355]">
          {info ? `Has enviado ${enviados.length} de ${info.maximo} avisos para esta sesión.` : 'Cargando…'}
        </p>
        {enviados.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {enviados.map((a) => (
              <li key={a.id} className="corte-card border border-[#E2E6CF] bg-white p-3">
                <p className="text-[11px] text-[#6B7355]">
                  {fechaHora(a.created_at)} · a {a.destinatarios} {a.destinatarios === 1 ? 'participante' : 'participantes'}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#1F2400]">{a.mensaje}</p>
                {a.entregados < a.destinatarios && info?.sesion_activa && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-amber-800">
                    Entregado a {a.entregados} de {a.destinatarios}.
                    <button type="button" onClick={() => reintentar(a.id)} className="inline-flex items-center gap-1 font-semibold underline">
                      <RotateCw className="h-3 w-3" strokeWidth={2} />
                      Reintentar los pendientes
                    </button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
