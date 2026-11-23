'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { DIAS_SEMANA, horaValida } from '../../lib/seriesSesiones'

const inputHora =
  'w-[5.25rem] bg-transparent text-sm font-semibold text-[#1F2400] focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden'

// Horas como etiquetas editables: cada hora es un pequeño campo que se puede cambiar en el sitio y
// tiene su aspa para quitarla; debajo, el campo para añadir otra.
function EtiquetasHoras({ horas, onChange, etiqueta }) {
  const [nueva, setNueva] = useState('')
  const [aviso, setAviso] = useState('')

  function anadir() {
    if (!horaValida(nueva)) {
      setAviso('Elige una hora.')
      return
    }
    if (horas.includes(nueva)) {
      setAviso('Esa hora ya está.')
      return
    }
    onChange([...horas, nueva])
    setNueva('')
    setAviso('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="list" aria-label={etiqueta}>
        {horas.map((h, i) => (
          <span
            key={i}
            role="listitem"
            className="inline-flex items-center gap-1 corte-tag border border-[#B5E600] bg-[#EDF5C9] py-1 pl-2.5 pr-1"
          >
            <input
              type="time"
              value={h}
              onChange={(e) => onChange(horas.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`Hora ${i + 1} de ${etiqueta}`}
              className={inputHora}
            />
            <button
              type="button"
              onClick={() => onChange(horas.filter((_, j) => j !== i))}
              aria-label={`Quitar las ${h}`}
              className="rounded-full p-1 text-[#3D4A00] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {horas.length === 0 && <span className="text-xs text-[#6B7355]">Aún no hay horas.</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="time"
          value={nueva}
          onChange={(e) => {
            setNueva(e.target.value)
            setAviso('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              anadir()
            }
          }}
          aria-label={`Nueva hora para ${etiqueta}`}
          className="w-28 rounded-lg border border-[#E2E6CF] bg-white px-2.5 py-1.5 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
        />
        <button
          type="button"
          onClick={anadir}
          className="inline-flex items-center gap-1 corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Añadir hora
        </button>
        {aviso && <span className="text-xs text-amber-700">{aviso}</span>}
      </div>
    </div>
  )
}

// Selector de días de la semana y de horas: las mismas para todos los días o personalizadas por día.
//   patron = { dias: [1,3,5], personalizado: bool, horas: ['17:00'], horasPorDia: { 1: ['17:00'] } }
export default function EditorPatron({ patron, onChange }) {
  const dias = [...patron.dias].sort((a, b) => a - b)

  function alternarDia(n) {
    if (patron.dias.includes(n)) {
      const { [n]: _quitado, ...resto } = patron.horasPorDia || {}
      onChange({ ...patron, dias: patron.dias.filter((d) => d !== n), horasPorDia: resto })
    } else {
      onChange({
        ...patron,
        dias: [...patron.dias, n],
        // Al añadir un día en modo personalizado arranca con las horas comunes para ahorrar pasos.
        horasPorDia: patron.personalizado
          ? { ...(patron.horasPorDia || {}), [n]: patron.horasPorDia?.[n]?.length ? patron.horasPorDia[n] : [...patron.horas] }
          : patron.horasPorDia,
      })
    }
  }

  function alternarPersonalizado(activo) {
    if (activo) {
      const horasPorDia = {}
      for (const n of patron.dias) horasPorDia[n] = patron.horasPorDia?.[n]?.length ? patron.horasPorDia[n] : [...patron.horas]
      onChange({ ...patron, personalizado: true, horasPorDia })
    } else {
      onChange({ ...patron, personalizado: false })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-[#1F2400]">Días de la semana</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
          {DIAS_SEMANA.map((d) => {
            const activo = patron.dias.includes(d.n)
            return (
              <button
                key={d.n}
                type="button"
                onClick={() => alternarDia(d.n)}
                aria-pressed={activo}
                aria-label={d.nombre}
                title={d.nombre}
                className={`h-10 w-10 rounded-full border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] ${
                  activo
                    ? 'border-[#B5E600] bg-[#B5E600] text-[#1F2400]'
                    : 'border-[#E2E6CF] bg-white text-[#6B7355] hover:border-[#B5E600]'
                }`}
              >
                {d.corta}
              </button>
            )
          })}
        </div>
      </div>

      {dias.length > 0 && (
        <>
          {!patron.personalizado && (
            <div>
              <p className="mb-2 text-sm font-medium text-[#1F2400]">Horas (las mismas todos los días)</p>
              <EtiquetasHoras horas={patron.horas} onChange={(horas) => onChange({ ...patron, horas })} etiqueta="todos los días" />
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#1F2400]">
            <input
              type="checkbox"
              checked={patron.personalizado}
              onChange={(e) => alternarPersonalizado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#B5E600]"
            />
            <span>
              <span className="font-medium">Personalizar horas por día</span>
              <span className="block text-xs text-[#6B7355]">Cada día tendrá sus propias horas.</span>
            </span>
          </label>

          {patron.personalizado && (
            <div className="flex flex-col gap-3">
              {dias.map((n) => {
                const nombre = DIAS_SEMANA.find((d) => d.n === n)?.nombre
                return (
                  <div key={n} className="corte-card border border-[#E2E6CF] bg-[#FBFAF3] p-3">
                    <p className="mb-2 text-sm font-bold text-[#1F2400]">{nombre}</p>
                    <EtiquetasHoras
                      horas={patron.horasPorDia?.[n] || []}
                      onChange={(horas) => onChange({ ...patron, horasPorDia: { ...(patron.horasPorDia || {}), [n]: horas } })}
                      etiqueta={nombre.toLowerCase()}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
