'use client'

import { Dumbbell } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TituloBloque from './TituloBloque'
import { CATEGORIAS, NIVELES, inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

export default function BloqueQueVasADar({ c }) {
  return (
    <RevelarAlLlegar className={tarjetaClass}>
      <TituloBloque Icono={Dumbbell}>Qué vas a dar</TituloBloque>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Título</label>
          <input type="text" value={c.titulo} onChange={(e) => c.setTitulo(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Categoría</label>
          <select value={c.categoria} onChange={(e) => c.setCategoria(e.target.value)} className={inputClass}>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tipo de actividad</label>
          <input
            type="text"
            value={c.tipoActividad}
            onChange={(e) => c.setTipoActividad(e.target.value)}
            className={inputClass}
            placeholder={
              c.categoria === 'Quedadas deportivas'
                ? 'Ej: fútbol, voleibol, pádel, baloncesto...'
                : 'Ej: Zumba, boxeo, running...'
            }
          />
          <p className={ayudaClass}>Esto lo verán quienes reserven, tal cual lo escribas.</p>
        </div>

        <div>
          <label className={labelClass}>Nivel</label>
          <select value={c.nivel} onChange={(e) => c.setNivel(e.target.value)} className={inputClass}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
    </RevelarAlLlegar>
  )
}
