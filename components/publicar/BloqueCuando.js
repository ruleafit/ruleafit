'use client'

import { CalendarClock, Repeat } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import EditorPatron from '../series/EditorPatron'
import TituloBloque from './TituloBloque'
import VistaPreviaSerie from './VistaPreviaSerie'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

const opcionClass = (activa) =>
  `flex cursor-pointer items-start gap-2.5 corte-card border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-[#B5E600] ${
    activa ? 'border-[#B5E600] bg-[#EDF5C9]' : 'border-[#E2E6CF] bg-white hover:border-[#B5E600]'
  }`

// c = campos del formulario (useFormularioPublicar); previa = useVistaPreviaSerie.
export default function BloqueCuando({ c, previa }) {
  const sinEmpezar = !c.repInicio && !c.repFin && c.patron.dias.length === 0

  return (
    <RevelarAlLlegar delayMs={80} className={tarjetaClass}>
      <TituloBloque Icono={CalendarClock}>Cuándo</TituloBloque>
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#1F2400]">
            <Repeat className="h-4 w-4 text-[#3D4A00]" strokeWidth={2} />
            ¿Quieres repetir esta actividad?
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className={opcionClass(!c.repetir)}>
              <input
                type="radio"
                name="repetir"
                checked={!c.repetir}
                onChange={() => c.setRepetir(false)}
                className="mt-0.5 accent-[#B5E600]"
              />
              <span className="font-medium text-[#1F2400]">No, publicar una sola sesión</span>
            </label>
            <label className={opcionClass(c.repetir)}>
              <input
                type="radio"
                name="repetir"
                checked={c.repetir}
                onChange={() => {
                  c.setRepetir(true)
                  if (!c.repInicio && c.fecha) c.setRepInicio(c.fecha)
                }}
                className="mt-0.5 accent-[#B5E600]"
              />
              <span className="font-medium text-[#1F2400]">Sí, repetir semanalmente</span>
            </label>
          </div>
        </fieldset>

        {!c.repetir && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Fecha</label>
              <input
                type="date"
                value={c.fecha}
                onChange={(e) => {
                  c.setFecha(e.target.value)
                  c.setFechaPropuesta(false)
                }}
                required
                className={inputClass}
              />
              {c.fechaPropuesta && (
                <p className={ayudaClass}>Propuesta: una semana después de la sesión copiada. Cámbiala si quieres.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Hora</label>
              <input type="time" value={c.hora} onChange={(e) => c.setHora(e.target.value)} required className={inputClass} />
            </div>
          </div>
        )}

        {c.repetir && (
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Fecha de inicio</label>
              <input type="date" value={c.repInicio} onChange={(e) => c.setRepInicio(e.target.value)} className={inputClass} />
              <p className={ayudaClass}>Desde qué fecha empezarán a generarse las sesiones.</p>
            </div>

            <EditorPatron patron={c.patron} onChange={c.setPatron} />

            <div>
              <label className={labelClass}>¿Hasta qué fecha quieres repetir esta actividad?</label>
              <input type="date" value={c.repFin} onChange={(e) => c.setRepFin(e.target.value)} min={c.repInicio || undefined} className={inputClass} />
              <p className={ayudaClass}>Se incluye esa fecha si es uno de los días elegidos.</p>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Duración (minutos)</label>
          <input type="number" value={c.duracion} onChange={(e) => c.setDuracion(e.target.value)} className={inputClass} min="0" />
        </div>

        {c.repetir &&
          (sinEmpezar ? (
            <p className="corte-card border border-dashed border-[#E2E6CF] px-4 py-3 text-sm text-[#6B7355]">
              Elige la fecha de inicio, los días, las horas y la fecha final para ver aquí el resumen y las fechas reales.
            </p>
          ) : (
            <VistaPreviaSerie previa={previa} titulo={c.titulo} />
          ))}
      </div>
    </RevelarAlLlegar>
  )
}
