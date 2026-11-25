'use client'

import { Lock } from 'lucide-react'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import TituloBloque from '../publicar/TituloBloque'
import { labelClass, tarjetaClass, soloLecturaClass } from './constantes'

export default function BloqueNoEditable({ clase }) {
  return (
    <div className={tarjetaClass}>
      <TituloBloque Icono={Lock}>Esto no se puede cambiar</TituloBloque>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Fecha</label>
          <p className={soloLecturaClass}>{formatearFechaParaMostrar(clase.fecha)}</p>
        </div>
        <div>
          <label className={labelClass}>Hora</label>
          <p className={soloLecturaClass}>{clase.hora}</p>
        </div>
        <div>
          <label className={labelClass}>Duración</label>
          <p className={soloLecturaClass}>{clase.duracion != null ? `${clase.duracion} min` : '—'}</p>
        </div>
        <div>
          <label className={labelClass}>Precio</label>
          <p className={soloLecturaClass}>{clase.precio != null ? `${clase.precio} €` : '—'}</p>
        </div>
      </div>
    </div>
  )
}
