'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ESTADOS } from '../../../lib/verificaciones/reglas'
import VisorDocumento from '../VisorDocumento'

// Titulación denunciada dentro de /admin/denuncias: qué decía, cómo está ahora
// y acceso para comprobarla. Se aprueba o retira en /admin/verificaciones.
export default function DenunciaTitulacion({ denuncia }) {
  const [viendo, setViendo] = useState(false)
  const t = denuncia.titulacion
  const conDocumento = t && ['pendiente', 'aprobada'].includes(t.estado)

  return (
    <div className="mt-1">
      <p className="text-sm font-semibold text-[#1F2400]">{denuncia.detalle}</p>
      <p className="text-sm text-[#6B7355]">
        Estado actual: {!t ? 'borrada por su autor' : t.estado === 'pendiente' ? 'Declarada, sin revisar' : ESTADOS[t.estado]}
      </p>
      {conDocumento && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViendo(true)}
            className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]"
          >
            Ver documento
          </button>
          <Link href="/admin/verificaciones" className="text-xs font-semibold text-[#3D4A00] underline">
            Aprobar o retirar en Verificaciones
          </Link>
        </div>
      )}
      {viendo && <VisorDocumento titulacion={t} onCerrar={() => setViendo(false)} />}
    </div>
  )
}
