'use client'

import CabeceraClases from '../../components/clases/CabeceraClases'
import FiltrosClases from '../../components/clases/FiltrosClases'
import MapaYLeyenda from '../../components/clases/MapaYLeyenda'
import ListaClases from '../../components/clases/ListaClases'
import useUsuarioYFavoritos from '../../components/clases/useUsuarioYFavoritos'
import useClasesListado from '../../components/clases/useClasesListado'

export default function ClasesPage() {
  const seg = useUsuarioYFavoritos()
  const f = useClasesListado(seg)

  if (f.cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraClases />

      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-3 sm:px-6">
        {f.error && <p className="mb-4 text-sm text-red-600">{f.error}</p>}

        {!f.error && f.totalClases === 0 && <p className="text-sm text-[#6B7355]">No hay sesiones disponibles por ahora.</p>}

        {!f.error && f.totalClases > 0 && (
          <>
            <FiltrosClases f={f} seg={seg} />

            <div id="resultados-sesiones" className="grid scroll-mt-24 grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
              <MapaYLeyenda clases={f.clasesFiltradas} />
              <ListaClases f={f} usuario={seg.usuario} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
