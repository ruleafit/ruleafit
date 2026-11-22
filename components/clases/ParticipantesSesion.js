'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../RevelarAlLlegar'

// Apartado «Quién participa» del DETALLE de una sesión (no aparece en tarjetas, mapa ni
// ventanas emergentes). Toda la privacidad se decide en el servidor
// (public.participantes_clase, sql/085): aquí solo se pinta lo que llega. A un usuario
// anónimo no llega ningún dato que lo identifique.
//   plazasOcupadas: al cambiar (alguien reserva o cancela) se vuelve a cargar la lista.
export default function ParticipantesSesion({ claseId, usuario, esOrganizador, plazasOcupadas, className = '' }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      if (!usuario) {
        setFilas(null)
        return
      }
      const { data, error: err } = await supabase.rpc('participantes_clase', { p_clase_id: claseId })
      if (cancelado) return
      if (err) {
        setError(true)
        return
      }
      setError(false)
      setFilas(data || [])
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [claseId, usuario?.id, plazasOcupadas])

  return (
    <RevelarAlLlegar delayMs={120} className={className}>
      <div className="mb-5 flex items-center gap-3 border-l-4 border-[#B5E600] pl-3">
        <Users className="h-6 w-6 shrink-0 text-[#3D4A00]" strokeWidth={1.75} />
        <h2 className="text-lg font-bold tracking-tight text-[#3D4A00] sm:text-xl">Quién participa</h2>
      </div>

      {!usuario ? (
        <p className="text-sm text-[#6B7355]">
          <Link href="/login" className="font-semibold text-[#3D4A00] underline">Inicia sesión</Link> para ver quién ha reservado.
        </p>
      ) : error ? (
        <p className="text-sm text-[#6B7355]">No hemos podido cargar los participantes. Inténtalo de nuevo más tarde.</p>
      ) : filas === null ? (
        <p className="text-sm text-[#6B7355]">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-[#6B7355]">Todavía no hay nadie con reserva.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {filas.map((p, i) => (
              <li key={i}>
                {p.username ? (
                  <Link
                    href={`/entrenador/${encodeURIComponent(p.username)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E6CF] bg-[#FBFAF3] px-3 py-1.5 text-sm font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
                  >
                    @{p.username}
                    {p.es_yo && <span className="text-xs font-medium text-[#6B7355]">(tú)</span>}
                    {esOrganizador && p.oculto && !p.es_yo && (
                      <span className="text-xs font-medium text-[#6B7355]">(oculto para los demás)</span>
                    )}
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-[#E2E6CF] bg-white px-3 py-1.5 text-sm text-[#6B7355]">
                    Usuario anónimo
                  </span>
                )}
              </li>
            ))}
          </ul>
          {esOrganizador && (
            <p className="mt-3 text-xs text-[#6B7355]">
              Como organizador ves siempre el usuario de todas las personas que han reservado.
            </p>
          )}
          {!esOrganizador && filas.some((p) => p.es_yo && p.oculto) && (
            <p className="mt-3 text-xs text-[#6B7355]">
              Los demás te ven como «Usuario anónimo». Puedes mostrar tu @ en{' '}
              <Link href="/cuenta#tu-perfil" className="font-semibold text-[#3D4A00] underline">Mi cuenta → Tu perfil</Link>.
            </p>
          )}
        </>
      )}
    </RevelarAlLlegar>
  )
}
