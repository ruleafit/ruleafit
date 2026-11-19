'use client'

import { useState } from 'react'
import BonosComprados from '../../components/BonosComprados'
import useMisReservas from '../../components/mis-reservas/useMisReservas'
import CabeceraMisReservas from '../../components/mis-reservas/CabeceraMisReservas'
import PestanasMisReservas from '../../components/mis-reservas/PestanasMisReservas'
import ListaMisReservas from '../../components/mis-reservas/ListaMisReservas'

export default function MisReservasPage() {
  const m = useMisReservas()
  const [pestana, setPestana] = useState('reservas')

  if (m.cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraMisReservas />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <PestanasMisReservas pestana={pestana} onCambiar={setPestana} />

        {pestana === 'bonos' && <BonosComprados />}

        {pestana === 'reservas' && <ListaMisReservas m={m} />}
      </div>
    </div>
  )
}
