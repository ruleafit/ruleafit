'use client'

import { calcularReparto, formatearEuros } from '../../lib/pagos/dinero.ts'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'
import { centimosDePrecio, precioValido } from './precio'

// Solo informativo: la comisión real la calcula la base de datos
// (config_pagos.comision_bps, 1000 = 10 %) al crear el cobro.
const COMISION_BPS_PREVISTA = 1000

export default function PrevisionIngreso({ precio }) {
  if (!precioValido(precio)) {
    return (
      <p className="mt-1 text-xs text-red-600">
        El precio debe tener como máximo 2 decimales (por ejemplo 12,50).
      </p>
    )
  }

  const centimos = centimosDePrecio(precio)
  if (!PAGOS_VISIBLES || !centimos) return null

  const reparto = calcularReparto(centimos, COMISION_BPS_PREVISTA)

  return (
    <p className="mt-1 text-xs text-[#3D4A00]">
      Recibirás <span className="font-semibold">{formatearEuros(reparto.neto)}</span> tras la comisión de Ruleafit (
      {COMISION_BPS_PREVISTA / 100} %: {formatearEuros(reparto.comision)}). Es una estimación.
    </p>
  )
}
