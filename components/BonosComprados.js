'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleAlert, Gift } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { PAGOS_VISIBLES } from '../lib/pagosVisibles'
import EstadoBonoComprado from './bonos/EstadoBonoComprado'

function formatearFecha(fechaIso) {
  if (!fechaIso) return ''
  return new Date(fechaIso).toLocaleDateString('es-ES')
}

export default function BonosComprados({ onReclamar }) {
  const [bonos, setBonos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [estados, setEstados] = useState({}) // con pagos online (sql/107)
  const [recienPagado, setRecienPagado] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.rpc('mis_bonos_comprados')
    if (error) {
      setError(error.message)
      setCargando(false)
      return
    }
    if (PAGOS_VISIBLES) {
      const { data: pagados } = await supabase.rpc('mis_bonos_estado')
      setEstados(pagados || {})
    }
    setBonos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    setRecienPagado(new URLSearchParams(window.location.search).get('pago') === 'ok')
    cargar()
  }, [])

  if (cargando) {
    return <p className="text-sm text-[#6B7355]">Cargando tus bonos...</p>
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
        <p className="font-medium">{error}</p>
      </div>
    )
  }

  if (bonos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 corte-card border border-dashed border-[#E2E6CF] px-6 py-10 text-center">
        <Gift className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">
          Todavía no has comprado ningún bono. Búscalos en el perfil del entrenador con el que quieras entrenar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {recienPagado && (
        <p role="status" className="corte-card border border-[#B5E600] bg-[#EDF5C9] p-3 text-sm text-[#1F2400]">
          Pago recibido. Tu bono ya está en la lista; si no lo ves, recarga en unos segundos.
        </p>
      )}
      {bonos.map((bono) => {
        const estado = estados[bono.bono_cliente_id]
        const caducado = !estado?.anulado && new Date(bono.fecha_fin) < new Date()
        const ilimitado = bono.numero_sesiones === null
        const porcentaje = ilimitado
          ? 0
          : Math.min((Number(bono.sesiones_usadas) / bono.numero_sesiones) * 100, 100)

        return (
          <div
            key={bono.bono_cliente_id}
            className={`corte-card border p-5 ${
              caducado ? 'border-red-200 bg-red-50' : 'border-[#E2E6CF] bg-white'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm text-[#6B7355]">
                  Bono de{' '}
                  <Link
                    href={`/entrenador/${bono.trainer_username}`}
                    className="font-semibold text-[#3D4A00] hover:underline"
                  >
                    @{bono.trainer_username}
                  </Link>
                </p>
                <h3 className="text-base font-bold text-[#1F2400]">
                  {ilimitado ? 'Sesiones ilimitadas' : `${bono.numero_sesiones} sesiones`}
                </h3>
                {bono.descripcion && <p className="mt-1 text-sm text-[#1F2400]">{bono.descripcion}</p>}
              </div>
              {estado?.anulado && (
                <span className="shrink-0 corte-tag border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
                  Anulado
                </span>
              )}
              {caducado && (
                <span className="shrink-0 corte-tag border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-600">
                  Caducado
                </span>
              )}
            </div>

            <div className="mt-3">
              {!ilimitado && (
                <>
                  <p className="mb-1 text-xs font-medium text-[#6B7355]">
                    {bono.sesiones_usadas} de {bono.numero_sesiones} sesiones usadas
                  </p>
                  <div className="h-1.5 w-full overflow-hidden corte-barra bg-[#EDF5C9]">
                    <div
                      className="h-full corte-barra bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </>
              )}
              {ilimitado && (
                <p className="text-xs font-medium text-[#6B7355]">{bono.sesiones_usadas} sesiones usadas</p>
              )}
            </div>

            <p className={`mt-3 text-xs ${caducado ? 'text-red-500' : 'text-[#6B7355]'}`}>
              {estado?.anulado
                ? `Anulado el ${formatearFecha(bono.fecha_fin)}`
                : estado?.sin_caducidad
                  ? 'Sin caducidad'
                  : `${caducado ? 'Caducó' : 'Caduca'} el ${formatearFecha(bono.fecha_fin)}`}
            </p>
            {PAGOS_VISIBLES && (
              <EstadoBonoComprado id={bono.bono_cliente_id} estado={estado} onHecho={cargar} onReclamar={onReclamar} />
            )}
          </div>
        )
      })}
    </div>
  )
}
