'use client'

import { CalendarClock } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TituloBloque from './TituloBloque'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

export default function BloqueCuando({ c }) {
  return (
    <RevelarAlLlegar delayMs={80} className={tarjetaClass}>
      <TituloBloque Icono={CalendarClock}>Cuándo</TituloBloque>
      <div className="flex flex-col gap-4">
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

        <div>
          <label className={labelClass}>Duración (minutos)</label>
          <input type="number" value={c.duracion} onChange={(e) => c.setDuracion(e.target.value)} className={inputClass} min="0" />
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
