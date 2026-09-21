'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { geocodificar } from '../lib/geocodificar'

const MINIMO_CARACTERES = 4
const RETARDO_DEBOUNCE_MS = 400

export default function BuscadorDireccion({ onSeleccionar, onLimpiar, placeholder = 'Buscar calle o lugar' }) {
  const [texto, setTexto] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const controladorRef = useRef(null)
  const contenedorRef = useRef(null)
  const teniaTextoRef = useRef(false)

  useEffect(() => {
    const textoNormalizado = texto.trim()

    if (textoNormalizado.length === 0 && teniaTextoRef.current) {
      onLimpiar?.()
    }
    teniaTextoRef.current = textoNormalizado.length > 0

    if (textoNormalizado.length < MINIMO_CARACTERES) {
      setSugerencias([])
      setCargando(false)
      setAbierto(false)
      return
    }

    const idTimeout = setTimeout(async () => {
      if (controladorRef.current) {
        controladorRef.current.abort()
      }

      const controlador = new AbortController()
      controladorRef.current = controlador

      setCargando(true)

      const resultados = await geocodificar(textoNormalizado, { signal: controlador.signal })

      if (controlador.signal.aborted) return

      setSugerencias(resultados)
      setCargando(false)
      setAbierto(true)
    }, RETARDO_DEBOUNCE_MS)

    return () => clearTimeout(idTimeout)
  }, [texto])

  useEffect(() => {
    function handleClickFuera(evento) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target)) {
        setAbierto(false)
      }
    }

    document.addEventListener('click', handleClickFuera)
    return () => document.removeEventListener('click', handleClickFuera)
  }, [])

  function handleSeleccionar(sugerencia) {
    onSeleccionar(sugerencia)
    setTexto(sugerencia.nombre)
    setAbierto(false)
    setSugerencias([])
  }

  function handleLimpiar() {
    setTexto('')
    setSugerencias([])
    setAbierto(false)
    teniaTextoRef.current = false
    onLimpiar?.()
  }

  const mostrarSinResultados =
    abierto && !cargando && sugerencias.length === 0 && texto.trim().length >= MINIMO_CARACTERES

  return (
    <div ref={contenedorRef} className="relative w-full">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => {
          if (sugerencias.length > 0) setAbierto(true)
        }}
        placeholder={placeholder}
        className="w-full corte-btn border-2 border-[#B5E600] bg-white px-4 py-2 pr-8 text-sm text-[#16231B] placeholder:text-[#6B7355] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
      />

      {texto && (
        <button
          type="button"
          onClick={handleLimpiar}
          aria-label="Borrar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7355] hover:text-[#16231B]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}

      {cargando && (
        <p className="mt-1 text-xs text-[#6B7355]">Buscando...</p>
      )}

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute left-0 top-full z-[1000] mt-1 max-h-60 w-full overflow-y-auto corte-card border border-[#E2E6CF] bg-white py-1 shadow-lg">
          {sugerencias.map((sugerencia, indice) => (
            <li key={`${sugerencia.lat}-${sugerencia.lng}-${indice}`}>
              <button
                type="button"
                onClick={() => handleSeleccionar(sugerencia)}
                className="block w-full px-4 py-2 text-left text-sm text-[#16231B] hover:bg-[#F5F7E8]"
              >
                {sugerencia.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mostrarSinResultados && (
        <p className="absolute left-0 top-full z-[1000] mt-1 w-full corte-card border border-[#E2E6CF] bg-white px-4 py-2 text-xs text-[#6B7355] shadow-lg">
          Sin resultados
        </p>
      )}
    </div>
  )
}
