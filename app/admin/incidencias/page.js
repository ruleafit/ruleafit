'use client'

import { useState } from 'react'
import usePanelAdmin from '../../../components/admin/usePanelAdmin'
import SinAccesoAdmin from '../../../components/admin/SinAccesoAdmin'
import TarjetaCasoAdmin from '../../../components/admin/TarjetaCasoAdmin'
import { estaCerrada } from '../../../lib/pagos/incidencias.ts'

// Reclamaciones económicas. Solo administradores (la comprobación real la hace app/api/admin/incidencias).
export default function IncidenciasAdminPage() {
  const { estadoCarga, datos, cambiar } = usePanelAdmin('/api/admin/incidencias')
  const [soloAbiertas, setSoloAbiertas] = useState(true)

  if (estadoCarga !== 'ok') return <SinAccesoAdmin estado={estadoCarga} />

  const casos = (datos.incidencias || []).filter((c) => !soloAbiertas || !estaCerrada(c.estado))

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Reclamaciones de pagos</h1>
      <p className="mt-1 text-sm text-[#6B7355]">
        Mientras un caso está abierto o en revisión, el importe queda retenido al organizador. Si le das la razón al
        alumno usa <strong>Devolver y cerrar</strong>; cambiar solo el estado a cerrado libera el dinero al organizador.
      </p>
      <label className="mt-4 mb-6 flex items-center gap-2 text-sm text-[#1F2400]">
        <input type="checkbox" checked={soloAbiertas} onChange={(e) => setSoloAbiertas(e.target.checked)} />
        Solo abiertas
      </label>
      {casos.length === 0 && <p className="text-sm text-[#6B7355]">No hay casos que mostrar.</p>}
      <ul className="flex flex-col gap-4">
        {casos.map((c) => (
          <TarjetaCasoAdmin key={c.id} caso={c} onCambiar={cambiar} />
        ))}
      </ul>
    </div>
  )
}
