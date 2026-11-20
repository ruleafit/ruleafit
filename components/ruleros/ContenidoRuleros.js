'use client'

import { useRef, useState } from 'react'
import PestanasRuleros from './PestanasRuleros'
import TarjetaRulero from './TarjetaRulero'
import EstadoVacioRuleros from './EstadoVacioRuleros'

const filtroCampoClass =
  'block w-full corte-btn border border-[#E2E6CF] bg-white px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'

// Buscador arriba (encuentra a CUALQUIER rulero) y debajo las pestañas
// Favoritos | Seguidos. Siempre se entra en Favoritos. Mientras hay texto
// en el buscador se muestran los resultados de toda la comunidad (sin
// pestañas); al borrarlo se vuelve a la pestaña en la que estabas.
export default function ContenidoRuleros({ datos }) {
  const { ruleros, favoritosIds, seguidosIds } = datos
  const [busqueda, setBusqueda] = useState('')
  const [pestana, setPestana] = useState('favoritos')
  const campoBusqueda = useRef(null)

  const texto = busqueda.trim().toLowerCase()
  const buscando = texto.length > 0

  const favoritos = ruleros.filter((r) => favoritosIds.includes(r.id))
  const seguidos = ruleros.filter((r) => seguidosIds.includes(r.id))
  const resultados = ruleros.filter((r) => (r.username || '').toLowerCase().includes(texto))
  const lista = buscando ? resultados : pestana === 'favoritos' ? favoritos : seguidos

  function enfocarBuscador() {
    campoBusqueda.current?.focus()
    campoBusqueda.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 corte-card border border-[#E2E6CF] bg-white/70 p-4 sm:p-5">
        <div className="sm:w-72">
          <label htmlFor="busqueda-ruleros" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
            Buscar
          </label>
          <input
            id="busqueda-ruleros"
            ref={campoBusqueda}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre de usuario"
            className={filtroCampoClass}
          />
        </div>
      </div>

      {!buscando && (
        <PestanasRuleros
          pestana={pestana}
          setPestana={setPestana}
          totalFavoritos={favoritos.length}
          totalSeguidos={seguidos.length}
        />
      )}

      {buscando && (
        <p className="mb-4 text-sm font-semibold text-[#3D4A00]">
          Resultados de la búsqueda ({resultados.length})
        </p>
      )}

      <div id="panel-ruleros" role={buscando ? undefined : 'tabpanel'} aria-labelledby={buscando ? undefined : `pestana-${pestana}`}>
        {lista.length === 0 && (
          <EstadoVacioRuleros
            tipo={buscando ? 'busqueda' : pestana}
            onBuscar={enfocarBuscador}
            onLimpiar={() => setBusqueda('')}
          />
        )}

        {lista.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((rulero, indice) => (
              <TarjetaRulero
                key={rulero.id}
                rulero={rulero}
                indice={indice}
                etiquetas={
                  buscando
                    ? { favorito: favoritosIds.includes(rulero.id), siguiendo: seguidosIds.includes(rulero.id) }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
