'use client'

import { useState } from 'react'
import { peticionAdmin } from './useColaVerificaciones'

// Pide un enlace temporal a un documento (solo administradores).
export default function VerDocumento({ tipo, id, cara, texto = 'Ver documento' }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  async function pedir() {
    setError('')
    const respuesta = await peticionAdmin(
      `/api/admin/verificaciones/archivo?tipo=${tipo}&id=${id}${cara ? `&cara=${cara}` : ''}`
    )
    const json = await respuesta?.json().catch(() => null)
    if (!respuesta?.ok) return setError(json?.error || 'No se pudo abrir el documento.')
    setUrl(json.url)
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={pedir}
        className="corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]"
      >
        {texto}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#3D4A00] underline">
          Abrir (caduca en 60 segundos)
        </a>
      )}
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </span>
  )
}
