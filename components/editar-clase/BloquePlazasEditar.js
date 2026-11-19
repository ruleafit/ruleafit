'use client'

import { Tag } from 'lucide-react'
import TituloBloque from '../publicar/TituloBloque'
import { inputClass, labelClass, ayudaClass, tarjetaClass, soloLecturaClass } from './constantes'

export default function BloquePlazasEditar({ f, clase, sinMinimoDefinido }) {
  return (
    <div className={tarjetaClass}>
      <TituloBloque Icono={Tag}>Plazas</TituloBloque>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Plazas mínimas</label>
          {sinMinimoDefinido ? (
            <>
              <p className={soloLecturaClass}>Sin mínimo definido</p>
              <p className={ayudaClass}>Esta sesión no tiene mínimo. No se puede añadir uno desde aquí.</p>
            </>
          ) : (
            <>
              <input
                type="number"
                value={f.plazasMin}
                onChange={(e) => f.setPlazasMin(e.target.value)}
                className={inputClass}
                min="1"
                step="1"
              />
              <p className={ayudaClass}>
                Solo se puede bajar (mínimo actual: {clase.plazas_min}), nunca subir, y nunca por debajo de 1.
              </p>
            </>
          )}
        </div>

        <div>
          <label className={labelClass}>Plazas máximas</label>
          <input
            type="number"
            value={f.plazasMax}
            onChange={(e) => f.setPlazasMax(e.target.value)}
            className={inputClass}
            min={clase.plazas_max}
            step="1"
          />
          <p className={ayudaClass}>Solo se puede subir (máximo actual: {clase.plazas_max}), nunca bajar.</p>
        </div>
      </div>
    </div>
  )
}
