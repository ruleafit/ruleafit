'use client'

import { Dumbbell } from 'lucide-react'
import TituloBloque from '../publicar/TituloBloque'
import { CATEGORIAS, NIVELES, inputClass, labelClass, ayudaClass, tarjetaClass } from './constantes'

// f = valores y setters del formulario (FormularioEditarClase).
export default function BloqueDatosEditables({ f }) {
  return (
    <div className={tarjetaClass}>
      <TituloBloque Icono={Dumbbell}>Qué vas a dar</TituloBloque>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Título</label>
          <input type="text" value={f.titulo} onChange={(e) => f.setTitulo(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Categoría</label>
          <select value={f.categoria} onChange={(e) => f.setCategoria(e.target.value)} className={inputClass}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tipo de actividad</label>
          <input
            type="text"
            value={f.tipoActividad}
            onChange={(e) => f.setTipoActividad(e.target.value)}
            className={inputClass}
            placeholder="Ej: Zumba, boxeo, running..."
          />
          <p className={ayudaClass}>Esto lo verán quienes reserven, tal cual lo escribas.</p>
        </div>

        <div>
          <label className={labelClass}>Nivel</label>
          <select value={f.nivel} onChange={(e) => f.setNivel(e.target.value)} className={inputClass}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Material necesario</label>
          <input type="text" value={f.material} onChange={(e) => f.setMaterial(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Observaciones</label>
          <textarea
            value={f.observaciones}
            onChange={(e) => f.setObservaciones(e.target.value)}
            className={`${inputClass} min-h-[100px]`}
          />
        </div>

        <div>
          <label className={labelClass}>Punto de encuentro</label>
          <input
            type="text"
            value={f.puntoEncuentro}
            onChange={(e) => f.setPuntoEncuentro(e.target.value)}
            className={inputClass}
          />
          <p className={ayudaClass}>Sé concreto: ayuda a que nadie se pierda.</p>
        </div>
      </div>
    </div>
  )
}
