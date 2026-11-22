'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Bloque desplegable de «Mi cuenta». Mismo estilo que el botón «Filtros» de Explorar
// sesiones (borde lima, flecha que gira). El contenido SIEMPRE está montado (solo se
// oculta con una animación de altura), así que no se pierde lo escrito en un
// formulario al cerrar y volver a abrir el bloque.
//   id            ancla del bloque (p. ej. /cuenta#avisos-zona)
//   abrirConHash  hashes de la URL que abren el bloque al entrar
export default function BloqueDesplegable({
  id,
  titulo,
  icono: Icono,
  abiertoInicial = false,
  abrirConHash = [],
  className = '',
  children,
}) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const panelId = `panel-${id}`

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && (hash === id || abrirConHash.includes(hash))) setAbierto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section id={id} className={`mb-4 scroll-mt-24 ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 corte-btn border-2 border-[#B5E600] bg-white px-5 py-3 text-left text-base font-bold text-[#3D4A00] shadow-md transition-colors hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icono && <Icono className="h-5 w-5 shrink-0 text-[#B5E600]" strokeWidth={2} />}
          <span className="truncate">{titulo}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-label={titulo}
        inert={!abierto}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 corte-card border border-[#E2E6CF] bg-white p-5 sm:p-6 [&>*:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
