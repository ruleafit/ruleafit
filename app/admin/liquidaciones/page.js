'use client'

import { useState } from 'react'
import usePanelAdmin from '../../../components/admin/usePanelAdmin'
import SinAccesoAdmin from '../../../components/admin/SinAccesoAdmin'
import PrevisionLiquidacion from '../../../components/admin/PrevisionLiquidacion'
import LineaLiquidacion from '../../../components/admin/LineaLiquidacion'
import BloqueFicheroBanco from '../../../components/admin/BloqueFicheroBanco'

// Liquidaciones a organizadores (sql/114). Solo administradores (la comprobación real la hace la ruta de la API).
export default function LiquidacionesAdminPage() {
  const { estadoCarga, datos, cambiar, cargar } = usePanelAdmin('/api/admin/liquidaciones')
  // Sube tras cada cambio: el bloque del fichero vuelve a leer sus datos.
  const [version, setVersion] = useState(0)
  async function cambiarYRefrescar(cuerpo) {
    const fallo = await cambiar(cuerpo)
    if (!fallo) setVersion((v) => v + 1)
    return fallo
  }

  if (estadoCarga !== 'ok') return <SinAccesoAdmin estado={estadoCarga} />

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Liquidaciones</h1>
      <p className="mt-1 text-sm text-[#6B7355]">
        Aquí no se envía dinero: se cierra cada corte, se firma un fichero en el banco y se marca como enviado.
      </p>
      <PrevisionLiquidacion datos={datos} onCerrar={() => cambiarYRefrescar({ accion: 'cerrar' })} />
      <BloqueFicheroBanco key={version} onCambio={cargar} />
      <section className="mt-10">
        <h2 className="mb-3 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
          Transferencias
        </h2>
        {datos.lineas.length === 0 && <p className="text-sm text-[#6B7355]">Todavía no hay ninguna.</p>}
        <ul className="flex flex-col gap-2">
          {datos.lineas.map((l) => (
            <LineaLiquidacion key={l.id} linea={l} onMarcar={(accion) => cambiarYRefrescar({ accion, linea: l.id })} />
          ))}
        </ul>
      </section>
    </div>
  )
}
