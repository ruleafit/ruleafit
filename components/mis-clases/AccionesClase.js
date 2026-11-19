'use client'

import Link from 'next/link'
import { Ban, Pencil, Copy } from 'lucide-react'
import { motivoNoEditableClase } from '../../lib/ventanaEdicionClase'
import BotonCompartir from '../BotonCompartir'

export default function AccionesClase({ clase, haPasado, procesandoCancelacion, errorCancelacion, onCancelar }) {
  const esEditable = !motivoNoEditableClase({
    fecha: clase.clase_fecha,
    hora: clase.clase_hora,
    estado: clase.estado,
  })

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {!haPasado && (
          <Link
            href={`/clases/${clase.clase_id}?from=mis-clases`}
            className="corte-tag border border-[#E2E6CF] px-2.5 py-1 text-xs font-medium text-[#6B7355] transition-colors hover:border-[#B5E600] hover:text-[#1F2400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
          >
            Ver detalles
          </Link>
        )}
        <Link
          href={`/publicar?copiar=${clase.clase_id}`}
          className="inline-flex items-center gap-1.5 corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9]"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          Copiar sesión
        </Link>
        {clase.estado === 'activa' && !haPasado && (
          <BotonCompartir
            clase={{
              id: clase.clase_id,
              titulo: clase.clase_titulo,
              fecha: clase.clase_fecha,
              hora: clase.clase_hora,
              categoria: clase.categoria,
            }}
            variante="completo"
            className="inline-flex items-center gap-1.5 corte-tag border border-[#E2E6CF] bg-white px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
          />
        )}
        {esEditable && (
          <Link
            href={`/mis-clases/${clase.clase_id}/editar`}
            className="inline-flex items-center gap-1.5 corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            Editar
          </Link>
        )}
      </div>

      {clase.estado === 'activa' && !haPasado && (
        <div className="mt-3 flex flex-col items-end gap-1.5 border-t border-[#E2E6CF] pt-3">
          <button
            type="button"
            onClick={() => onCancelar(clase.clase_id)}
            disabled={procesandoCancelacion}
            className="inline-flex items-center gap-1.5 corte-tag px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
            {procesandoCancelacion ? 'Cancelando...' : 'Cancelar esta sesión'}
          </button>
          {errorCancelacion && <p className="text-xs text-red-600">{errorCancelacion}</p>}
        </div>
      )}
    </>
  )
}
