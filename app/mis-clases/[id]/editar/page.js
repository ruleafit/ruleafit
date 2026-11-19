'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import useCargaEditarClase from '../../../../components/editar-clase/useCargaEditarClase'
import CabeceraEditar from '../../../../components/editar-clase/CabeceraEditar'
import FormularioEditarClase from '../../../../components/editar-clase/FormularioEditarClase'

function Cargando() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <p className="text-[#6B7355]">Cargando...</p>
    </div>
  )
}

export default function EditarClasePage() {
  const { id } = useParams()
  const { cargando, clase, motivoNoEditable, errorCarga } = useCargaEditarClase(id)

  if (cargando) return <Cargando />

  if (errorCarga) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraEditar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <p className="font-medium">{errorCarga}</p>
          </div>
        </div>
      </div>
    )
  }

  if (motivoNoEditable) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraEditar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-2 corte-card border border-[#E2E6CF] bg-white p-6 text-sm text-[#6B7355] shadow-sm">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.75} />
            <p>{motivoNoEditable}</p>
          </div>
          <Link
            href="/mis-clases"
            className="mt-4 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Volver a Mis sesiones
          </Link>
        </div>
      </div>
    )
  }

  if (!clase) return <Cargando />

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraEditar />

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <FormularioEditarClase id={id} clase={clase} />
      </div>
    </div>
  )
}
