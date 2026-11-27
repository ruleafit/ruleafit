'use client'

import Link from 'next/link'
import { ESTADOS } from '../../../lib/verificaciones/reglas'
import VerDocumento from './VerDocumento'

// Titulación denunciada dentro de /admin/denuncias: qué decía, cómo está ahora
// y acceso para comprobarla. Se aprueba o retira en /admin/verificaciones.
export default function DenunciaTitulacion({ denuncia }) {
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
          <VerDocumento tipo="titulacion" id={t.id} />
          <Link href="/admin/verificaciones" className="text-xs font-semibold text-[#3D4A00] underline">
            Aprobar o retirar en Verificaciones
          </Link>
        </div>
      )}
    </div>
  )
}
