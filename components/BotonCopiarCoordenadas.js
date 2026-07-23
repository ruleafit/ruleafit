'use client'

import { useState } from 'react'

export default function BotonCopiarCoordenadas({ lat, lng, className, onError }) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(`${lat}, ${lng}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch (err) {
      if (onError) onError(err)
    }
  }

  return (
    <button type="button" onClick={handleCopiar} className={className}>
      {copiado ? 'Copiado' : 'Copiar coordenadas'}
    </button>
  )
}
