'use client'

import { useEffect, useRef, useState } from 'react'
import { buscarCiudades } from '../lib/geocodificar'

const MINIMO_CARACTERES = 4
const RETARDO_DEBOUNCE_MS = 400

// Campo de ciudad con autocompletado de toda España. El texto lo controla el
// padre (valor / onCambiarTexto); ciudadElegida es la ya confirmada, que no se
// vuelve a buscar. Al elegir una sugerencia se llama a
// onSeleccionar({ nombre, provincia, lat, lng }).
export default function BuscadorCiudad({ id, valor, ciudadElegida, onCambiarTexto, onSeleccionar, className }) {
  const [sugerencias, setSugerencias] = useState([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const contenedorRef = useRef(null)

  useEffect(() => {
    const texto = valor.trim()

    if (texto.length < MINIMO_CARACTERES || texto === ciudadElegida) {
      setSugerencias([])
      setCargando(false)
      setAbierto(false)
      return
    }

    const controlador = new AbortController()
    const idTimeout = setTimeout(async () => {
      setCargando(true)
      const resultados = await buscarCiudades(texto, { signal: controlador.signal })
      if (controlador.signal.aborted) return
      setSugerencias(resultados)
      setCargando(false)
      setAbierto(true)
    }, RETARDO_DEBOUNCE_MS)

    return () => {
      clearTimeout(idTimeout)
      controlador.abort()
    }
  }, [valor, ciudadElegida])

  useEffect(() => {
    function handleClickFuera(evento) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target)) {
        setAbierto(false)
      }
    }

    document.addEventListener('click', handleClickFuera)
    return () => document.removeEventListener('click', handleClickFuera)
  }, [])

  function handleSeleccionar(ciudad) {
    onSeleccionar(ciudad)
    setAbierto(false)
    setSugerencias([])
  }

  const mostrarSinResultados =
    abierto && !cargando && sugerencias.length === 0 && valor.trim().length >= MINIMO_CARACTERES

  return (
    <div ref={contenedorRef} className="relative w-full">
      <input
        id={id}
        type="text"
        value={valor}
        onChange={(e) => onCambiarTexto(e.target.value)}
        onFocus={() => {
          if (sugerencias.length > 0) setAbierto(true)
        }}
        placeholder="Escribe tu ciudad, ej: Granada"
        autoComplete="off"
        className={className}
      />

      {cargando && <p className="mt-1 text-xs text-[#6B7355]">Buscando...</p>}

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute left-0 top-full z-[1000] mt-1 max-h-60 w-full overflow-y-auto corte-card border border-[#E2E6CF] bg-white py-1 shadow-lg">
          {sugerencias.map((ciudad, indice) => (
            <li key={`${ciudad.lat}-${ciudad.lng}-${indice}`}>
              <button
                type="button"
                onClick={() => handleSeleccionar(ciudad)}
                className="block w-full px-4 py-2 text-left text-sm text-[#16231B] hover:bg-[#F5F7E8]"
              >
                <span className="font-medium">{ciudad.nombre}</span>
                {ciudad.detalle && <span className="text-[#6B7355]"> · {ciudad.detalle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mostrarSinResultados && (
        <p className="absolute left-0 top-full z-[1000] mt-1 w-full corte-card border border-[#E2E6CF] bg-white px-4 py-2 text-xs text-[#6B7355] shadow-lg">
          No encontramos esa ciudad
        </p>
      )}
    </div>
  )
}
