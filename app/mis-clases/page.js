'use client'

import { useState } from 'react'
import GestionBonos from '../../components/GestionBonos'
import useMisClases from '../../components/mis-clases/useMisClases'
import CabeceraMisClases from '../../components/mis-clases/CabeceraMisClases'
import PestanasMisClases from '../../components/mis-clases/PestanasMisClases'
import ListaMisClases from '../../components/mis-clases/ListaMisClases'

export default function MisClasesPage() {
  const m = useMisClases()
  const [pestana, setPestana] = useState('sesiones')

  if (m.cargandoSesion || m.cargandoDatos) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraMisClases />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <PestanasMisClases pestana={pestana} onCambiar={setPestana} />

        {pestana === 'bonos' && <GestionBonos usuario={m.usuario} />}

        {pestana === 'sesiones' && <ListaMisClases m={m} />}
      </div>
    </div>
  )
}
