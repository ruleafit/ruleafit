'use client'

import { useEffect, useState } from 'react'
import { ingerirVolverDeUrl, leerRetorno } from '../../lib/retorno'

// C03 · Aviso en /login y /registro cuando se llega desde el panel de reserva: recuerda qué sesión espera.
// También recoge ?volver=/clases/<id> de la URL (validado) para que el retorno funcione aunque el almacenamiento
// estuviera vacío.
export default function AvisoRetorno({ className = '' }) {
  const [retorno, setRetorno] = useState(null)
  useEffect(() => {
    setRetorno(ingerirVolverDeUrl() || leerRetorno())
  }, [])
  if (!retorno) return null
  return (
    <p className={`rounded-lg border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm text-[#3D4A00] ${className}`}>
      {retorno.titulo ? <>Vas a reservar <strong>{retorno.titulo}</strong>. </> : 'Tienes una sesión seleccionada. '}
      Al terminar volverás a ella para confirmar tu reserva.
    </p>
  )
}
