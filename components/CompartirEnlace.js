'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Share2, MessageCircle } from 'lucide-react'

// Compartir un enlace (invitación o perfil): menú nativo del móvil cuando existe, siempre «Copiar enlace» y un acceso
// directo a WhatsApp con un enlace estándar. No pide acceso a los contactos ni exige instalar la app.
//   url           enlace completo
//   etiqueta      texto del botón de compartir («Compartir invitación», «Compartir mi perfil»…)
//   textoMensaje  mensaje que acompaña al enlace
export default function CompartirEnlace({ url, etiqueta, titulo, textoMensaje, mostrarCampo = true, className = '' }) {
  const [copiado, setCopiado] = useState(false)
  const [nativo, setNativo] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setNativo(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  async function copiar() {
    setError('')
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      try {
        // Respaldo para navegadores sin portapapeles asíncrono.
        const area = document.createElement('textarea')
        area.value = url
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      } catch {
        setError('No se ha podido copiar. Selecciona el enlace y cópialo a mano.')
        return
      }
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function compartir() {
    setError('')
    try {
      await navigator.share({ title: titulo, text: textoMensaje, url })
    } catch (e) {
      if (e?.name !== 'AbortError') setError('No se ha podido abrir el menú de compartir. Usa «Copiar enlace».')
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${textoMensaje} ${url}`)}`
  const boton =
    'inline-flex items-center justify-center gap-2 corte-btn border-2 border-[#1F2400] bg-white px-4 py-2 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2'
  const botonPrimario =
    'inline-flex items-center justify-center gap-2 corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

  return (
    <div className={className}>
      {mostrarCampo && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Enlace para compartir"
          className="mb-3 block w-full rounded-lg border border-[#E2E6CF] bg-[#F7F9EC] px-3 py-2 text-sm text-[#1F2400]"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className={boton}>
          {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copiado ? '¡Copiado!' : 'Copiar enlace'}
        </button>
        {nativo ? (
          <button type="button" onClick={compartir} className={botonPrimario}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {etiqueta}
          </button>
        ) : (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={botonPrimario}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {etiqueta}
          </a>
        )}
        {nativo && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={boton}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
