'use client'

import { Repeat, Euro } from 'lucide-react'
import TituloBloque from '../publicar/TituloBloque'
import { inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

const OPCIONES = [
  { valor: 'solo_esta', titulo: 'Solo esta sesión', texto: 'Cambia únicamente la sesión que estás editando.' },
  { valor: 'esta_y_siguientes', titulo: 'Esta y las siguientes', texto: 'Cambia esta sesión y todas las posteriores de la serie.' },
  { valor: 'toda_futura', titulo: 'Toda la serie futura', texto: 'Cambia todas las sesiones futuras de la serie.' },
]

// Solo para sesiones que pertenecen a una serie: a qué sesiones se aplican los cambios y, aparte,
// el precio y la duración (que solo se modifican en las sesiones SIN reservas).
export default function BloqueSerieEditar({ f }) {
  return (
    <>
      <div className={tarjetaClass}>
        <TituloBloque Icono={Repeat}>Esta sesión forma parte de una serie</TituloBloque>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[#1F2400]">¿A qué sesiones quieres aplicar los cambios?</legend>
          <div className="flex flex-col gap-2">
            {OPCIONES.map((o) => (
              <label
                key={o.valor}
                className={`flex cursor-pointer items-start gap-2.5 corte-card border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-[#B5E600] ${
                  f.alcance === o.valor ? 'border-[#B5E600] bg-[#EDF5C9]' : 'border-[#E2E6CF] bg-white hover:border-[#B5E600]'
                }`}
              >
                <input
                  type="radio"
                  name="alcance"
                  checked={f.alcance === o.valor}
                  onChange={() => f.setAlcance(o.valor)}
                  className="mt-0.5 accent-[#B5E600]"
                />
                <span>
                  <span className="block font-semibold text-[#1F2400]">{o.titulo}</span>
                  <span className="block text-xs text-[#6B7355]">{o.texto}</span>
                </span>
              </label>
            ))}
          </div>
          <p className={ayudaClass}>
            Las sesiones pasadas nunca se modifican. Las plazas, el título y demás se aplican con las mismas reglas de siempre: si alguna
            sesión no admite el cambio, se omite y te lo indicamos.
          </p>
        </fieldset>
      </div>

      <div className={tarjetaClass}>
        <TituloBloque Icono={Euro}>Precio y duración</TituloBloque>
        <p className="mb-3 text-xs text-[#6B7355]">
          Solo se cambian en las sesiones que todavía no tienen reservas. Las que ya tienen participantes no se tocan.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Precio (€)</label>
            <input type="number" min="0" step="0.01" value={f.precio} onChange={(e) => f.setPrecio(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Duración (minutos)</label>
            <input type="number" min="1" value={f.duracion} onChange={(e) => f.setDuracion(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>
    </>
  )
}
