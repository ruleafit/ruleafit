'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import useCargaEditarClase from '../../../../components/editar-clase/useCargaEditarClase'
import FormularioReprogramar from '../../../../components/editar-clase/FormularioReprogramar'

export default function ReprogramarSesionPage() {
  const { id } = useParams()
  const { cargando, clase, motivoNoEditable, errorCarga } = useCargaEditarClase(id)
  const problema = errorCarga || motivoNoEditable

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Reprogramar sesión</h1>
      {!cargando && problema ? (
        <p className="mt-4 corte-card border border-[#E2E6CF] bg-white p-4 text-sm text-[#6B7355]">{problema}</p>
      ) : cargando || !clase ? (
        <p className="mt-4 text-[#6B7355]">Cargando...</p>
      ) : (
        <FormularioReprogramar id={id} clase={clase} />
      )}
      <Link href="/mis-clases" className="mt-6 inline-block text-sm font-semibold text-[#3D4A00] underline">
        Volver a Mis sesiones
      </Link>
    </div>
  )
}
