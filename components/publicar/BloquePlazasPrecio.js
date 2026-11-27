'use client'

import Link from 'next/link'
import { Tag } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TituloBloque from './TituloBloque'
import PrevisionIngreso, { COMISION_BPS_PREVISTA } from './PrevisionIngreso'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

export default function BloquePlazasPrecio({ c }) {
  return (
    <RevelarAlLlegar delayMs={240} className={tarjetaClass}>
      <TituloBloque Icono={Tag}>Plazas y precio</TituloBloque>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Precio (€)</label>
            <input type="number" value={c.precio} onChange={(e) => c.setPrecio(e.target.value)} className={inputClass} min="0" step="0.01" />
            {Number(c.precio) === 0 ? (
              <>
                <p className="mt-1 text-sm font-semibold text-[#3D4A00]">Sesión gratuita (0 €).</p>
                <p className="text-xs text-[#6B7355]">
                  Publica directamente: las sesiones gratis no necesitan datos fiscales ni IBAN. Déjalo vacío o pon 0.
                </p>
              </>
            ) : PAGOS_VISIBLES ? (
              <>
                <p className="mt-1 text-sm font-semibold text-[#3D4A00]">Tus alumnos pagan online en Ruleafit al reservar.</p>
                <p className="text-xs text-[#6B7355]">
                  De cada pago se descuenta la comisión de Ruleafit ({COMISION_BPS_PREVISTA / 100} %). Tu parte se
                  libera en tu saldo después de celebrarse la sesión. Si se cancela, se devuelve al alumno. Para cobrar
                  necesitas tus datos fiscales aprobados.{' '}
                  <Link href="/mis-ingresos" className="font-semibold underline">Ver mis ingresos</Link>
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm font-semibold text-[#3D4A00]">Acuerda el precio con tus alumnos.</p>
                <p className="text-xs text-[#6B7355]">A día de hoy, el 100% es para ti.</p>
              </>
            )}
            <PrevisionIngreso precio={c.precio} />
          </div>
          <div>
            <label className={labelClass}>Plazas máximas</label>
            <input type="number" value={c.plazasMax} onChange={(e) => c.setPlazasMax(e.target.value)} required className={inputClass} min="1" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Plazas mínimas</label>
          <input
            type="number"
            value={c.plazasMin}
            onChange={(e) => c.setPlazasMin(e.target.value)}
            className={inputClass}
            min="0"
            step="1"
            placeholder="0 (sin mínimo)"
          />
          <p className={ayudaClass}>
            Si no se llega a este mínimo, la sesión aparecerá como pendiente de confirmación. Déjalo vacío si no quieres mínimo.
          </p>
        </div>

        <div>
          <label className={labelClass}>Material necesario<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
          <input type="text" value={c.material} onChange={(e) => c.setMaterial(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Observaciones<span className="font-normal text-[#6B7355]"> (Opcional)</span></label>
          <textarea
            value={c.observaciones}
            onChange={(e) => c.setObservaciones(e.target.value)}
            className={`${inputClass} min-h-[100px]`}
          />
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
