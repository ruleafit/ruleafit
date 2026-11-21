'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fechaHoyMadrid } from '../lib/ventanaEdicionClase'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const pad = (n) => String(n).padStart(2, '0')

// Calendario mensual compartido ("Mis sesiones publicadas" y perfil público).
// - diasConSesiones: Set/array de 'YYYY-MM-DD' con sesiones futuras activas (lima).
// - seleccionado: 'YYYY-MM-DD' o null. onSeleccionar(fecha|null).
// Semana desde lunes, fechas en Europe/Madrid. Los días anteriores a hoy van
// en gris y no se pueden pulsar; hoy sí. Cambiar de mes limpia la selección.
export default function CalendarioSesiones({ diasConSesiones, seleccionado, onSeleccionar }) {
  const hoy = fechaHoyMadrid()
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)) - 1)
  const conSesiones = diasConSesiones instanceof Set ? diasConSesiones : new Set(diasConSesiones)

  // getUTCDay: 0=domingo → desplazamiento para empezar en lunes.
  const huecosIniciales = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7
  const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const celdas = [...Array(huecosIniciales).fill(null), ...Array.from({ length: diasDelMes }, (_, i) => i + 1)]

  function cambiarMes(delta) {
    const nuevo = new Date(Date.UTC(anio, mes + delta, 1))
    setAnio(nuevo.getUTCFullYear())
    setMes(nuevo.getUTCMonth())
    onSeleccionar(null)
  }

  const botonMes =
    'flex h-9 w-9 items-center justify-center corte-btn border border-[#E2E6CF] bg-white text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#F5F7E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]'

  return (
    <div className="mb-6 corte-card border border-[#E2E6CF] bg-white p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className={botonMes}>
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <h2 className="text-base font-bold text-[#1F2400] sm:text-lg" aria-live="polite">
          {NOMBRES_MES[mes]} {anio}
        </h2>
        <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className={botonMes}>
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-semibold uppercase text-[#6B7355]">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`h${i}`} />
          const fecha = `${anio}-${pad(mes + 1)}-${pad(dia)}`
          const pasado = fecha < hoy
          const esHoy = fecha === hoy
          const activo = conSesiones.has(fecha)
          const elegido = seleccionado === fecha

          let clases = 'border-[#E2E6CF] bg-white text-[#1F2400] hover:border-[#B5E600]'
          if (pasado) clases = 'border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed'
          else if (activo) clases = 'border-[#B5E600] bg-[#B5E600] text-[#1F2400] font-bold hover:bg-[#a3d100]'
          if (elegido) clases += ' ring-2 ring-[#1F2400] ring-offset-1'
          else if (esHoy) clases += ' ring-1 ring-[#3D4A00]'

          return (
            <button
              key={fecha}
              type="button"
              disabled={pasado}
              onClick={() => onSeleccionar(fecha)}
              aria-pressed={elegido}
              aria-label={`${dia} de ${NOMBRES_MES[mes]}${activo ? ', con sesiones' : ''}${esHoy ? ', hoy' : ''}`}
              className={`flex h-10 items-center justify-center corte-btn border text-sm transition-colors sm:h-12 ${clases}`}
            >
              {dia}
            </button>
          )
        })}
      </div>
    </div>
  )
}
