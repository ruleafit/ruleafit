'use client'

import usePanelAdmin from '../../../components/admin/usePanelAdmin'
import SinAccesoAdmin from '../../../components/admin/SinAccesoAdmin'
import FormularioContracargo from '../../../components/admin/FormularioContracargo'
import ListaContracargos from '../../../components/admin/ListaContracargos'

// Contracargos que comunica el banco. Solo administradores (lo comprueba app/api/admin/contracargos).
export default function ContracargosAdminPage() {
  const { estadoCarga, datos, cambiar } = usePanelAdmin('/api/admin/contracargos')

  if (estadoCarga !== 'ok') return <SinAccesoAdmin estado={estadoCarga} />

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Contracargos</h1>
      <p className="mt-2 text-sm text-[#3d4426]">
        Un contracargo es un pago que el banco retira porque el titular de la tarjeta lo reclama. Anótalo en cuanto el banco
        te avise: el dinero queda retenido hasta que marques el resultado.
      </p>
      <FormularioContracargo onCambiar={cambiar} />
      <ListaContracargos contracargos={datos.contracargos || []} onCambiar={cambiar} />
    </div>
  )
}
