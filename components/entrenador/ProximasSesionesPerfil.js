'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import CalendarioSesiones from '../CalendarioSesiones'
import TarjetaClase from '../clases/TarjetaClase'
import { formatearFechaParaMostrar, diaSemanaParaMostrar } from '../../lib/formatoFecha'

// Próximas sesiones activas (aún sin empezar) de un rulero, con calendario.
// Al entrar NO se muestra ninguna tarjeta: solo al pulsar un día salen las de
// ese día (por hora). "Cerrar sesiones" (o volver a pulsar el día) las oculta.
// Reutiliza TarjetaClase; las sesiones llegan ya filtradas y ordenadas.
export default function ProximasSesionesPerfil({ perfil, clases, usuarioActual, onReservado }) {
  const [diaSel, setDiaSel] = useState(null)

  if (clases.length === 0) return null

  const diasConSesiones = new Set(clases.map((c) => c.fecha))
  const visibles = diaSel
    ? clases
        .filter((c) => c.fecha === diaSel)
        .sort((a, b) => (String(a.hora).slice(0, 5) < String(b.hora).slice(0, 5) ? -1 : 1))
    : []

  // Pulsar de nuevo el día seleccionado lo cierra.
  function alSeleccionar(fecha) {
    setDiaSel(fecha === diaSel ? null : fecha)
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
        Próximas sesiones de @{perfil.username}
      </h2>

      <CalendarioSesiones diasConSesiones={diasConSesiones} seleccionado={diaSel} onSeleccionar={alSeleccionar} />

      {diaSel && (
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-semibold text-[#3D4A00]">
            <span>
              Sesiones del <span className="capitalize">{diaSemanaParaMostrar(diaSel)}</span>{' '}
              {formatearFechaParaMostrar(diaSel)}
            </span>
            <button
              type="button"
              onClick={() => setDiaSel(null)}
              className="inline-flex items-center gap-1 text-xs font-bold underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Cerrar sesiones
            </button>
          </div>

          {visibles.length === 0 && (
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
        </div>
      )}
    </section>
  )
}
