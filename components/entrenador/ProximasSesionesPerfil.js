'use client'

import { useState } from 'react'
import CalendarioSesiones from '../CalendarioSesiones'
import BarraDiaCalendario from '../BarraDiaCalendario'
import TarjetaClase from '../clases/TarjetaClase'

// Próximas sesiones activas (aún sin empezar) de un rulero, con calendario.
// Reutiliza TarjetaClase; las sesiones llegan ya filtradas y ordenadas.
export default function ProximasSesionesPerfil({ perfil, clases, usuarioActual, onReservado }) {
  const [diaSel, setDiaSel] = useState(null)

  if (clases.length === 0) return null

  const diasConSesiones = new Set(clases.map((c) => c.fecha))
  const visibles = diaSel ? clases.filter((c) => c.fecha === diaSel) : clases

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        Próximas sesiones de @{perfil.username}
      </h2>

      <CalendarioSesiones diasConSesiones={diasConSesiones} seleccionado={diaSel} onSeleccionar={setDiaSel} />

      {diaSel && <BarraDiaCalendario fecha={diaSel} onVerTodas={() => setDiaSel(null)} />}

      {diaSel && visibles.length === 0 && (
        <p className="corte-card border border-[#E2E6CF] bg-white px-4 py-6 text-center text-sm text-[#6B7355]">
          No hay sesiones para esta fecha.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {visibles.map((clase, indice) => (
          <TarjetaClase
            key={clase.id}
            clase={clase}
            indice={indice}
            usuario={usuarioActual}
            onReservado={onReservado}
            onErrorCoordenadas={() => {}}
          />
        ))}
      </div>
    </section>
  )
}
