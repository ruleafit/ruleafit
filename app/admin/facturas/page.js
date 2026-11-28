'use client'

import usePanelAdmin from '../../../components/admin/usePanelAdmin'
import SinAccesoAdmin from '../../../components/admin/SinAccesoAdmin'
import BotonConfirmar from '../../../components/admin/BotonConfirmar'
import { descargarFactura } from '../../../components/ingresos/descargarFactura'
import { formatearEuros } from '../../../lib/pagos/dinero.ts'
import { BLOQUEOS_FACTURA, SITUACIONES_FACTURA, TIPOS_FACTURA } from '../../../lib/pagos/facturas.ts'

// Facturas de Ruleafit al organizador: comisión y Pro (sql/116). Solo administradores (la comprobación real la hace la ruta de la API).
export default function FacturasAdminPage() {
  const { estadoCarga, datos, cambiar } = usePanelAdmin('/api/admin/facturas')

  if (estadoCarga !== 'ok') return <SinAccesoAdmin estado={estadoCarga} />

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Facturas</h1>
      <p className="mt-1 text-sm text-[#6B7355]">
        {datos.validadas
          ? 'Facturación activada: emitir asigna un número definitivo y no se puede deshacer.'
          : 'Solo borradores, sin validez: falta que el asesor valide impuestos y formato.'}
      </p>
      <div className="mt-4">
        <BotonConfirmar
          principal
          texto="Actualizar borradores"
          pregunta="¿Rehacer todos los borradores con los datos actuales? Las facturas emitidas no cambian."
          onConfirmar={() => cambiar({ accion: 'generar' })}
        />
      </div>
      {datos.facturas.length === 0 && <p className="mt-4 text-sm text-[#6B7355]">Todavía no hay ninguna.</p>}
      <ul className="mt-4 flex flex-col gap-2">
        {datos.facturas.map((f) => (
          <li key={f.id} className="corte-card border border-[#E2E6CF] bg-white p-3 text-sm text-[#1F2400]">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">
                {f.numero || TIPOS_FACTURA[f.tipo]} · {f.username ? `@${f.username}` : 'cuenta eliminada'}
              </span>
              <strong>{formatearEuros(f.total_centimos)}</strong>
            </div>
            <p className="text-xs text-[#6B7355]">
              {SITUACIONES_FACTURA[f.estado]} · {f.concepto}
            </p>
            {f.bloqueos.length > 0 && f.estado === 'borrador' && (
              <p className="text-xs font-medium text-red-700">{f.bloqueos.map((b) => BLOQUEOS_FACTURA[b] || b).join(' · ')}</p>
            )}
            {f.rectificar && (
              <p className="text-xs font-medium text-red-700">Hay una devolución posterior: necesita factura rectificativa.</p>
            )}
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <button type="button" onClick={() => descargarFactura(f)} className="corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]">
                Descargar
              </button>
              {datos.validadas && f.estado === 'borrador' && f.bloqueos.length === 0 && (
                <BotonConfirmar
                  texto="Emitir"
                  pregunta="¿Emitir esta factura? Recibirá un número definitivo y se avisará al organizador."
                  onConfirmar={() => cambiar({ accion: 'emitir', factura: f.id })}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
