'use client'

import { Search, UserCheck } from 'lucide-react'
import { CATEGORIAS_FILTRO, FRANJAS_FILTRO, CUANDO_FILTRO } from './filtros'

const filtroCampoClass =
  'block w-full corte-btn border border-[#E2E6CF] bg-white px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600] sm:w-auto'

const filtroLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]'

// Filtro "solo sesiones de ruleros a los que sigo" (pedido por el usuario el
// 23 sept 2026): botón toggle, no un desplegable como el resto de filtros,
// ya que es un sí/no. Ajustado el mismo día a petición del usuario: el
// botón lleva solo el icono (el texto va fuera, al lado), algo más grande,
// y con el mismo marco lima grueso que "Ver mi ubicación" en el mapa
// (components/MapaClases.js) tanto apagado como encendido - encendido se
// rellena también de lima.
const filtroToggleActivoClass =
  'flex shrink-0 items-center justify-center corte-btn border-2 border-[#B5E600] bg-[#B5E600] p-2.5 text-[#1F2400] shadow-md transition-colors'
const filtroToggleInactivoClass =
  'flex shrink-0 items-center justify-center corte-btn border-2 border-[#B5E600] bg-white p-2.5 text-[#3D4A00] shadow-md transition-colors hover:bg-[#F5F7E8]'

// f = useClasesListado, seg = useUsuarioYSeguidos.
export default function FiltrosClases({ f, seg }) {
  // El filtrado ya se aplica al escribir; el botón "Buscar" (o Intro) cierra
  // el teclado en móvil y lleva la vista a los resultados, para que quede
  // claro que se ha hecho la búsqueda.
  function handleBuscar(e) {
    e.preventDefault()
    document.activeElement?.blur()
    document.getElementById('resultados-sesiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mb-8 flex flex-col gap-4 corte-card border border-[#E2E6CF] bg-white/70 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 sm:p-5">
      <form role="search" onSubmit={handleBuscar} className="w-full">
        <label htmlFor="busqueda-sesiones" className={filtroLabelClass}>Buscar actividad</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6B7355]" strokeWidth={1.75} />
            <input
              id="busqueda-sesiones"
              type="search"
              value={f.busqueda}
              onChange={(e) => f.setBusqueda(e.target.value)}
              placeholder="Ej: boxeo, yoga…"
              className="block w-full corte-btn border border-[#E2E6CF] bg-white py-2 pl-9 pr-4 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
            />
          </div>
          <button
            type="submit"
            className="flex shrink-0 items-center justify-center corte-btn bg-[#B5E600] px-5 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2"
          >
            Buscar
          </button>
        </div>
      </form>

      <div>
        <label htmlFor="busqueda-ciudad" className={filtroLabelClass}>Ciudad</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6B7355]" strokeWidth={1.75} />
          <input
            id="busqueda-ciudad"
            type="search"
            list="ciudades-sesiones"
            value={f.filtroCiudad}
            onChange={(e) => f.setFiltroCiudad(e.target.value)}
            placeholder="Tu ciudad o provincia"
            autoComplete="off"
            className={`${filtroCampoClass} pl-9 placeholder:text-[#6B7355]`}
          />
          <datalist id="ciudades-sesiones">
            {f.ciudadesDisponibles.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className={filtroLabelClass}>Categoría</label>
        <select value={f.filtroCategoria} onChange={(e) => f.setFiltroCategoria(e.target.value)} className={filtroCampoClass}>
          {CATEGORIAS_FILTRO.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={filtroLabelClass}>Cuándo</label>
        <select value={f.filtroCuando} onChange={(e) => f.setFiltroCuando(e.target.value)} className={filtroCampoClass}>
          {CUANDO_FILTRO.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={filtroLabelClass}>Franja horaria</label>
        <select value={f.filtroFranja} onChange={(e) => f.setFiltroFranja(e.target.value)} className={filtroCampoClass}>
          {FRANJAS_FILTRO.map((fr) => (
            <option key={fr.valor} value={fr.valor}>{fr.etiqueta}</option>
          ))}
        </select>
      </div>

      {seg.usuario && (
        <div>
          <label className={filtroLabelClass}>Ruleros</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => seg.setFiltroSoloSeguidos((valor) => !valor)}
              aria-pressed={seg.filtroSoloSeguidos}
              aria-label="Solo sesiones de ruleros a los que sigo"
              className={seg.filtroSoloSeguidos ? filtroToggleActivoClass : filtroToggleInactivoClass}
            >
              <UserCheck className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <span className="text-sm font-medium text-[#3D4A00]">
              Solo sesiones de ruleros a los que sigo
            </span>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[#6B7355]">
            <input
              type="checkbox"
              checked={seg.filtroSoloSeguidosFijado}
              onChange={(e) => seg.handleCambiarFijado(e.target.checked)}
              className="h-4 w-4 accent-[#B5E600]"
            />
            Mantener este filtro activado siempre que entre
          </label>
        </div>
      )}
    </div>
  )
}
