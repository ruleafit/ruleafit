'use client'

import usePanelAdmin from '../../../components/admin/usePanelAdmin'
import SinAccesoAdmin from '../../../components/admin/SinAccesoAdmin'
import BloqueFrenos from '../../../components/admin/BloqueFrenos'
import ListaAlertas from '../../../components/admin/ListaAlertas'
import RetencionesBonos from '../../../components/admin/RetencionesBonos'

// Alertas operativas y parada segura. Solo administradores (lo comprueba app/api/admin/alertas).
export default function AlertasAdminPage() {
  const { estadoCarga, datos, cambiar } = usePanelAdmin('/api/admin/alertas')

  if (estadoCarga !== 'ok') return <SinAccesoAdmin estado={estadoCarga} />

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Alertas operativas</h1>
      <BloqueFrenos paradas={datos.paradas || {}} onCambiar={cambiar} />
      <RetencionesBonos retenciones={datos.retenciones || []} onCambiar={cambiar} />
      <ListaAlertas alertas={datos.alertas || []} onCambiar={cambiar} />
    </div>
  )
}
