'use client'

import { Clock } from 'lucide-react'
import { plazoCancelacion } from '../lib/plazoCancelacion'

// Aviso discreto con el plazo de cancelación GRATUITA (solo informa; las reglas las aplica el servidor).
// Política vigente (sql/087): se puede cancelar hasta que empiece la sesión; con 2 h o más hay derecho
// a devolución y con menos de 2 h no (con bono, la sesión del bono queda consumida).
//   variante="detalle"  bajo el botón de reservar en /clases/[id]
//   variante="reserva"  dentro de una reserva activa en «Mis reservas»
//   tipo                solo en «reserva»: 'gratuita' | 'pago' | 'bono' (adapta el texto)
//   condicionesPago     texto extra para cuando los pagos online estén activos
export default function AvisoPlazoCancelacion({ clase, variante = 'detalle', tipo = 'gratuita', condicionesPago = false, className = '' }) {
  const plazo = plazoCancelacion(clase)
  if (plazo.estado === 'desconocido' || plazo.yaEmpezada) return null
  const { limite } = plazo
  const base = `flex items-start gap-1.5 text-xs leading-snug text-[#6B7355] ${className}`
  const reloj = <Clock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />

  if (variante === 'reserva') {
    let texto
    if (tipo === 'gratuita') {
      texto = 'Puedes cancelar hasta que comience la sesión.'
    } else if (plazo.estado === 'abierto') {
      texto =
        tipo === 'bono'
          ? `Puedes cancelar hasta las ${limite.hora} del ${limite.dia} y recuperar la sesión de tu bono.`
          : `Puedes cancelar con devolución hasta las ${limite.hora} del ${limite.dia}.`
    } else {
      texto =
        tipo === 'bono'
          ? 'El plazo de cancelación gratuita ha finalizado. Puedes cancelar hasta que comience la sesión, pero la sesión de tu bono se considerará consumida.'
          : 'El plazo de cancelación gratuita ha finalizado. Puedes cancelar hasta que comience la sesión, pero sin derecho a devolución.'
    }
    return (
      <p className={base}>
        {reloj}
        <span>{texto}</span>
      </p>
    )
  }

  if (plazo.estado === 'cerrado') {
    return (
      <p className={`${base} text-amber-800`}>
        {reloj}
        <span>Puedes cancelar tu reserva hasta que comience la sesión, pero si faltan menos de 2 horas no tendrás derecho a devolución.</span>
      </p>
    )
  }

  return (
    <div className={base}>
      {reloj}
      <div>
        <p className="font-medium text-[#3D4A00]">
          Puedes cancelar gratis hasta el {limite.dia} a las {limite.hora}.
        </p>
        <p className="text-[11px]">Con menos de 2 horas de antelación puedes cancelar, pero sin derecho a devolución.</p>
        {condicionesPago && (
          <p className="mt-0.5 text-[11px]">Si cancelas a tiempo, la devolución se gestiona según las condiciones del pago.</p>
        )}
      </div>
    </div>
  )
}
