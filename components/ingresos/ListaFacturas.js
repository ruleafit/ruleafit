'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { descargarFactura } from './descargarFactura'

// Facturas de Ruleafit al organizador (comisión y Pro, sql/116). Sin la función o sin facturas, no se muestra nada.
export default function ListaFacturas() {
  const [facturas, setFacturas] = useState([])

  useEffect(() => {
    let vivo = true
    supabase.rpc('mis_facturas').then(({ data }) => {
      if (vivo && Array.isArray(data)) setFacturas(data)
    })
    return () => {
      vivo = false
    }
  }, [])

  if (facturas.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-[#E2E6CF] pb-2 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        Facturas de Ruleafit
      </h2>
      <ul className="flex flex-col gap-2">
        {facturas.map((f) => (
          <li key={f.id} className="corte-card border border-[#E2E6CF] bg-white p-3 text-sm text-[#1F2400]">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{f.numero}</span>
              <strong>{formatearEuros(f.total_centimos)}</strong>
            </div>
            <p className="text-xs text-[#6B7355]">{f.concepto}</p>
            <button type="button" onClick={() => descargarFactura(f)} className="mt-2 text-xs font-semibold text-[#3D4A00] underline">
              Descargar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
