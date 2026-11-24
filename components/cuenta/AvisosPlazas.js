'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'

// C15 · «Avisos de plazas» en Mi cuenta: las sesiones completas para las que el usuario pidió aviso.
// Solo se muestran sus propios avisos (mis_avisos_plaza filtra por auth.uid()) y vigentes: si la sesión empieza o se
// cancela, desaparecen; si se reserva, el aviso se desactiva solo.
export default function AvisosPlazas() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [quitando, setQuitando] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('mis_avisos_plaza')
    if (e) setError('No hemos podido cargar tus avisos. Inténtalo de nuevo en unos minutos.')
    else {
      setError('')
      setLista(data || [])
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function dejarDeAvisar(claseId) {
    setQuitando(claseId)
    const { error: e } = await supabase.rpc('desactivar_aviso_plaza', { p_clase_id: claseId })
    setQuitando(null)
    if (e) setError('No se ha podido desactivar el aviso. Inténtalo de nuevo.')
    else setLista((prev) => (prev || []).filter((a) => a.clase_id !== claseId))
  }

  if (lista === null && !error) return <p className="text-sm text-[#6B7355]">Cargando…</p>

  return (
    <div>
      <p className="mb-3 text-sm text-[#6B7355]">
        Te avisamos si se libera una plaza en estas sesiones. El aviso no garantiza una reserva: quien reserve primero se queda con la plaza.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {lista && lista.length === 0 && !error && (
        <p className="text-sm text-[#6B7355]">No tienes avisos activos. Cuando una sesión esté completa, podrás pedir un aviso desde su ficha.</p>
      )}
      <ul className="flex flex-col gap-3">
        {(lista || []).map((a) => (
          <li key={a.clase_id} className="corte-card border border-[#E2E6CF] bg-white p-4">
            <Link href={`/clases/${a.clase_id}`} className="font-bold text-[#1F2400] hover:underline">
              {a.titulo}
            </Link>
            <p className="mt-0.5 text-sm text-[#6B7355]">
              {a.organizador ? `por @${a.organizador} · ` : ''}
              {formatearFechaParaMostrar(a.fecha)} · {String(a.hora).slice(0, 5)}
              {a.ciudad ? ` · ${a.ciudad}` : ''}
            </p>
            <p className="mt-1 text-sm">
              {a.hay_plaza ? (
                <span className="font-semibold text-[#3D4A00]">Hay plaza disponible ahora: ¡reserva antes de que se ocupe!</span>
              ) : (
                <span className="text-[#6B7355]">Aviso activo: esperando que se libere una plaza</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => dejarDeAvisar(a.clase_id)}
              disabled={quitando === a.clase_id}
              className="mt-2 text-sm font-semibold text-[#3D4A00] underline underline-offset-2 hover:text-[#1F2400] disabled:opacity-60"
            >
              {quitando === a.clase_id ? 'Quitando…' : 'Dejar de avisarme'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
