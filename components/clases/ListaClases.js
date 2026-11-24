'use client'

import { SearchX } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import { useState, useMemo } from 'react'
import GrupoSesiones from './GrupoSesiones'
import { agruparSesiones, firmaGrupo } from './agruparSesiones'

// f = useClasesListado.
export default function ListaClases({ f, usuario }) {
  // N11: una tarjeta por organizador y día, calculada sobre la lista YA filtrada (el mapa recibe la lista completa).
  const grupos = useMemo(
    () => agruparSesiones(f.clasesFiltradas, { cronologico: !f.mostrandoCercanas }),
    [f.clasesFiltradas, f.mostrandoCercanas]
  )
  // clave del grupo -> firma de sus sesiones cuando se abrió: si los filtros cambian las sesiones, se cierra.
  const [abiertos, setAbiertos] = useState({})

  return (
    <div className="flex flex-col gap-4">
      {f.buscandoCiudad && !f.hayEnLaCiudadConFiltros && (
        <p className="text-sm text-[#6B7355]">Buscando sesiones cerca de {f.textoCiudad}…</p>
      )}

      {f.mostrandoCercanas && f.clasesFiltradas.length > 0 && (
        <p className="corte-card border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm font-medium text-[#3D4A00]">
          {f.hayAlgunaEnLaCiudad
            ? `No hay sesiones en ${f.puntoCiudad.nombre} con estos filtros. Te mostramos las más cercanas.`
            : `No hay sesiones en ${f.puntoCiudad.nombre}. Te mostramos las más cercanas.`}
        </p>
      )}

      {!f.buscandoCiudad && f.clasesFiltradas.length === 0 && (
        <RevelarAlLlegar className="flex flex-col items-center gap-3 corte-card border border-[#E2E6CF] bg-white px-6 py-14 text-center">
          <SearchX className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
          <p className="text-sm text-[#6B7355]">
            No hay sesiones que coincidan con estos filtros ahora mismo. Prueba a cambiar la ciudad o la categoría.
          </p>
          <button
            type="button"
            onClick={f.limpiarFiltros}
            className="mt-1 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Limpiar filtros
          </button>
        </RevelarAlLlegar>
      )}

      {grupos.map((grupo, indice) => {
        const firma = firmaGrupo(grupo)
        return (
          <GrupoSesiones
            key={grupo.clave}
            grupo={grupo}
            indice={indice}
            usuario={usuario}
            onReservado={f.handleReservado}
            onErrorCoordenadas={() => f.setError('No se pudieron copiar las coordenadas.')}
            abierto={abiertos[grupo.clave] === firma}
            alternar={() =>
              setAbiertos((prev) => {
                const { [grupo.clave]: _, ...resto } = prev
                return prev[grupo.clave] === firma ? resto : { ...resto, [grupo.clave]: firma }
              })
            }
          />
        )
      })}
    </div>
  )
}
