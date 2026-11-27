'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import CompraBono from './CompraBono'
import { supabase } from '../../lib/supabaseClient'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

function formatearFechaLimite(plazoDias) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + plazoDias)
  return fecha.toLocaleDateString('es-ES')
}

export default function BonosEntrenador({ perfil, bonos, usuarioActual }) {
  const [adquiriendoId, setAdquiriendoId] = useState(null)
  const [mensajeBono, setMensajeBono] = useState('')
  const [errorBono, setErrorBono] = useState('')
  const [aLaVenta, setALaVenta] = useState([]) // con pagos online: ids que se pueden comprar (sql/107)

  useEffect(() => {
    if (!PAGOS_VISIBLES || !perfil?.id) return
    supabase.rpc('bonos_a_la_venta', { p_trainer: perfil.id }).then(({ data }) => setALaVenta(data || []))
  }, [perfil?.id])
  const visibles = PAGOS_VISIBLES ? bonos.filter((b) => aLaVenta.includes(b.id)) : bonos

  async function handleAdquirirBono(bono) {
    if (!usuarioActual) {
      setErrorBono('Inicia sesión para adquirir un bono.')
      return
    }

    const fechaLimite = formatearFechaLimite(bono.plazo_dias)
    const confirmado = window.confirm(
      `Vas a adquirir este bono de ${bono.precio} €. Debe consumirse antes del ${fechaLimite}. ` +
        'Las sesiones no utilizadas no son reembolsables. ¿Confirmas?'
    )
    if (!confirmado) return

    setAdquiriendoId(bono.id)
    setErrorBono('')
    setMensajeBono('')

    const { error } = await supabase.rpc('adquirir_bono', { p_bono_id: bono.id })

    setAdquiriendoId(null)

    if (error) {
      setErrorBono(error.message)
      return
    }

    setMensajeBono('Bono adquirido. Lo verás en "Mis reservas" → pestaña Bonos, y se usará automáticamente al reservar sesiones de este rulero.')
    setTimeout(() => setMensajeBono(''), 8000)
  }

  if (visibles.length === 0) return null

  return (
    <div className="mt-8 corte-card border border-[#E2E6CF] bg-white p-6">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        <Gift className="h-4 w-4 text-[#B5E600]" strokeWidth={1.75} />
        Bonos de @{perfil.username}
      </h2>

      {mensajeBono && (
        <p className="mb-3 rounded-lg border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-medium text-[#1F2400]">
          {mensajeBono}
        </p>
      )}
      {errorBono && <p className="mb-3 text-sm text-red-600">{errorBono}</p>}

      <div className="flex flex-col gap-3">
        {visibles.map((bono) => (
          <div
            key={bono.id}
            className="flex flex-col gap-2 rounded-lg border border-[#E2E6CF] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-[#1F2400]">
                {bono.numero_sesiones === null
                  ? 'Sesiones ilimitadas'
                  : `${bono.numero_sesiones} sesiones`}{' '}
                · {bono.precio} €
              </p>
              <p className="text-xs text-[#6B7355]">
                {bono.plazo_dias > 0 ? `Plazo de ${bono.plazo_dias} días para consumirlas desde la compra.` : 'Sin caducidad.'}
              </p>
              {bono.descripcion && <p className="mt-1 text-sm text-[#1F2400]">{bono.descripcion}</p>}
            </div>

            {PAGOS_VISIBLES && !usuarioActual && (
              <Link href="/login" className="shrink-0 text-sm font-semibold text-[#3D4A00] underline">
                Inicia sesión para comprar
              </Link>
            )}
            {PAGOS_VISIBLES && usuarioActual && usuarioActual.id !== perfil.id && <CompraBono bono={bono} />}
            {!PAGOS_VISIBLES && usuarioActual && usuarioActual.id !== perfil.id && (
              <button
                type="button"
                onClick={() => handleAdquirirBono(bono)}
                disabled={adquiriendoId === bono.id}
                className="shrink-0 corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {adquiriendoId === bono.id ? 'Adquiriendo...' : 'Adquirir'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
