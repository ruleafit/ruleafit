'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { AVISO_LEGAL_TITULACIONES } from '../../lib/verificaciones/reglas'

// Visor de un diploma (/api/verificaciones/documento). El navegador nunca recibe el archivo ni su dirección en
// el Storage: el servidor devuelve cada página como imagen con la marca de agua
// ya incrustada y aquí se pinta en un lienzo, sin descarga, impresión, menú
// contextual ni arrastre.
export default function VisorDocumento({ titulacion, onCerrar }) {
  const lienzo = useRef(null)
  const botonCerrar = useRef(null)
  const [pagina, setPagina] = useState(1)
  const [paginas, setPaginas] = useState(1)
  const [estado, setEstado] = useState('cargando')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setEstado('cargando')
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error('Inicia sesión para ver el documento.')
        const respuesta = await fetch(`/api/verificaciones/documento?id=${titulacion.id}&pagina=${pagina}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (!respuesta.ok) {
          const json = await respuesta.json().catch(() => null)
          throw new Error(json?.error || 'No se pudo abrir el documento.')
        }
        const imagen = await createImageBitmap(await respuesta.blob())
        const destino = lienzo.current
        if (cancelado || !destino) return
        destino.width = imagen.width
        destino.height = imagen.height
        destino.getContext('2d').drawImage(imagen, 0, 0)
        imagen.close()
        setPaginas(Number(respuesta.headers.get('x-paginas')) || 1)
        setEstado('ok')
      } catch (error) {
        if (cancelado) return
        setMensaje(error.message)
        setEstado('error')
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [titulacion.id, pagina])

  const cerrar = useCallback(() => onCerrar(), [onCerrar])

  useEffect(() => {
    const anterior = document.activeElement
    const desbordamiento = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('visor-documento-abierto')
    botonCerrar.current?.focus()
    function teclas(evento) {
      if (evento.key === 'Escape') cerrar()
      // Guardar e imprimir.
      if ((evento.ctrlKey || evento.metaKey) && ['s', 'p'].includes(evento.key.toLowerCase())) {
        evento.preventDefault()
        evento.stopPropagation()
      }
    }
    window.addEventListener('keydown', teclas, true)
    return () => {
      window.removeEventListener('keydown', teclas, true)
      document.body.style.overflow = desbordamiento
      document.documentElement.classList.remove('visor-documento-abierto')
      anterior?.focus?.()
    }
  }, [cerrar])

  const bloquear = (evento) => evento.preventDefault()

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Documento: ${titulacion.nombre}`}
      onContextMenu={bloquear}
      onDragStart={bloquear}
      onCopy={bloquear}
      className="visor-documento fixed inset-0 z-[2000] flex select-none items-center justify-center bg-black/80 p-3 sm:p-6"
    >
      <style>{'@media print { html.visor-documento-abierto body { display: none !important; } }'}</style>
      <div className="flex max-h-full w-full max-w-3xl flex-col corte-card bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E6CF] p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1F2400]">{titulacion.nombre}</p>
            <p className="truncate text-xs text-[#6B7355]">
              {titulacion.entidad} · {titulacion.anio}
            </p>
          </div>
          <button
            ref={botonCerrar}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="corte-tag border border-[#E2E6CF] p-1.5 text-[#1F2400] hover:border-[#B5E600]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto bg-[#F1F1EC] p-3">
          {estado === 'cargando' && <p className="py-12 text-center text-sm text-[#6B7355]">Cargando documento…</p>}
          {estado === 'error' && (
            <p role="alert" className="py-12 text-center text-sm text-red-700">{mensaje}</p>
          )}
          <canvas
            ref={lienzo}
            aria-label="Documento con marca de agua"
            className={`pointer-events-none mx-auto h-auto w-full ${estado === 'ok' ? 'block' : 'hidden'}`}
          />
        </div>

        {paginas > 1 && (
          <div className="flex items-center justify-center gap-4 border-t border-[#E2E6CF] p-2 text-sm text-[#1F2400]">
            <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="p-1 disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </button>
            Página {pagina} de {paginas}
            <button type="button" aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className="p-1 disabled:opacity-30">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        <p className="border-t border-[#E2E6CF] p-3 text-xs leading-relaxed text-[#6B7355]">{AVISO_LEGAL_TITULACIONES}</p>
      </div>
    </div>,
    document.body
  )
}
