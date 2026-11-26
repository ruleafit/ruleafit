'use client'

import { useEffect, useState } from 'react'
import BonosComprados from '../../components/BonosComprados'
import useMisReservas from '../../components/mis-reservas/useMisReservas'
import CabeceraMisReservas from '../../components/mis-reservas/CabeceraMisReservas'
import PestanasMisReservas from '../../components/mis-reservas/PestanasMisReservas'
import ListaMisReservas from '../../components/mis-reservas/ListaMisReservas'
import ListaReclamaciones from '../../components/mis-reservas/ListaReclamaciones'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

export default function MisReservasPage() {
  const m = useMisReservas()
  const [pestana, setPestana] = useState('reservas')
  const [reservaReclamada, setReservaReclamada] = useState('')

  useEffect(() => {
    if (PAGOS_VISIBLES && new URLSearchParams(window.location.search).get('pestana') === 'reclamaciones') {
      setPestana('reclamaciones')
    }
  }, [])

  function reclamar(reservaId) {
    setReservaReclamada(reservaId)
    setPestana('reclamaciones')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        <PestanasMisReservas pestana={pestana} onCambiar={setPestana} conReclamaciones={PAGOS_VISIBLES} />

        {pestana === 'bonos' && <BonosComprados />}

        {pestana === 'reservas' && <ListaMisReservas m={m} onReclamar={PAGOS_VISIBLES ? reclamar : undefined} />}

        {pestana === 'reclamaciones' && <ListaReclamaciones reservaInicial={reservaReclamada} />}
      </div>
    </div>
  )
}
