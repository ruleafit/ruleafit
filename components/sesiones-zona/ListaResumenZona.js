'use client'

import Link from 'next/link'
import { BellOff } from 'lucide-react'
import TarjetaClase from '../clases/TarjetaClase'

// r = useResumenZona.
export default function ListaResumenZona({ r }) {
  if (r.usuario === null) {
    return (
      <p className="text-sm text-[#6B7355]">
        Inicia sesión para ver las sesiones de tu resumen.{' '}
        <Link href="/login" className="font-semibold text-[#3D4A00] underline">Iniciar sesión</Link>
      </p>
    )
  }
  if (r.error) return <p className="text-sm text-red-600">{r.error}</p>

  if (!r.resumen) {
    return (
      <div className="flex flex-col items-center gap-3 corte-card border border-[#E2E6CF] bg-white px-6 py-14 text-center">
        <BellOff className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">No hemos encontrado ningún resumen de sesiones en tu zona.</p>
        <Link href="/clases" className="inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]">
          Ver todas las sesiones
        </Link>
      </div>
    )
  }

  const sinDisponibles = r.clases.length === 0
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[#6B7355]">
        {r.resumen.total_sesiones === 1 ? '1 sesión nueva' : `${r.resumen.total_sesiones} sesiones nuevas`} en tu zona.
        {r.clases.length < r.resumen.total_sesiones && !sinDisponibles && ' Te mostramos las que siguen disponibles.'}
      </p>
      {sinDisponibles && (
        <p className="corte-card border border-[#E2E6CF] bg-white px-4 py-6 text-center text-sm text-[#6B7355]">
          Estas sesiones ya han comenzado o se han cancelado.{' '}
          <Link href="/clases" className="font-semibold text-[#3D4A00] underline">Ver todas las sesiones</Link>
        </p>
      )}
      {r.clases.map((clase, indice) => (
        <TarjetaClase
          key={clase.id}
          clase={clase}
          indice={indice}
          usuario={r.usuario}
          onReservado={r.handleReservado}
          onErrorCoordenadas={() => r.setError('No se pudieron copiar las coordenadas.')}
        />
      ))}
    </div>
  )
}
