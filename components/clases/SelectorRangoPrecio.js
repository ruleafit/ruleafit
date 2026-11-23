'use client'

import { useRef, useState } from 'react'
import { Euro, RotateCcw } from 'lucide-react'
import { PRECIO_MINIMO, PRECIO_MAXIMO, textoPrecioRango } from './filtros'

const filtroLabelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7355]'

// Una sola barra con DOS tiradores (mínimo y máximo) de 0 € a 50 € en saltos de 1 €. Sin tocarla no hay
// restricción de precio (rango = null): salen todas las sesiones aunque superen 50 €. Al mover un tirador se
// aplica el rango elegido. Se usa con el dedo (arrastrar o tocar la barra), con ratón y con teclado
// (flechas ±1, Re Pág/Av Pág ±5, Inicio/Fin).
//   rango = null | { min, max }     onChange(rango)     onRestablecer()
export default function SelectorRangoPrecio({ rango, onChange, onRestablecer }) {
  const pista = useRef(null)
  const arrastrando = useRef(null) // 'min' | 'max' | null
  const [ultimo, setUltimo] = useState('max') // último tirador usado: va por encima si se solapan

  const v = rango || { min: PRECIO_MINIMO, max: PRECIO_MAXIMO }
  const pct = (valor) => ((valor - PRECIO_MINIMO) / (PRECIO_MAXIMO - PRECIO_MINIMO)) * 100
  const limitar = (n) => Math.min(PRECIO_MAXIMO, Math.max(PRECIO_MINIMO, Math.round(n)))

  function valorDesdeX(clientX) {
    const r = pista.current.getBoundingClientRect()
    const ratio = r.width > 0 ? (clientX - r.left) / r.width : 0
    return limitar(PRECIO_MINIMO + Math.min(1, Math.max(0, ratio)) * (PRECIO_MAXIMO - PRECIO_MINIMO))
  }

  // El mínimo nunca supera al máximo (pueden coincidir).
  function fijar(cual, valor) {
    const nuevo = cual === 'min' ? { min: Math.min(limitar(valor), v.max), max: v.max } : { min: v.min, max: Math.max(limitar(valor), v.min) }
    if (!rango || nuevo.min !== v.min || nuevo.max !== v.max) onChange(nuevo)
    setUltimo(cual)
  }

  function alPulsar(e) {
    if (e.button !== undefined && e.button !== 0) return
    const valor = valorDesdeX(e.clientX)
    const tocado = e.target.closest?.('[data-tirador]')?.dataset.tirador
    let cual = tocado
    if (!cual) {
      // Se toca la barra: se mueve el tirador más cercano (si coinciden, hacia donde se ha tocado).
      if (v.min === v.max) cual = valor < v.min ? 'min' : 'max'
      else cual = Math.abs(valor - v.min) <= Math.abs(valor - v.max) ? 'min' : 'max'
    }
    arrastrando.current = cual
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // sin captura (p. ej. puntero ya liberado): el arrastre sigue por los eventos del propio contenedor
    }
    if (!tocado) fijar(cual, valor)
    else setUltimo(cual)
  }

  function alMover(e) {
    if (!arrastrando.current) return
    fijar(arrastrando.current, valorDesdeX(e.clientX))
  }

  function alSoltar(e) {
    arrastrando.current = null
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // nada que liberar
    }
  }

  function alTeclear(e, cual) {
    const actual = cual === 'min' ? v.min : v.max
    const pasos = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }
    let valor
    if (e.key in pasos) valor = actual + pasos[e.key]
    else if (e.key === 'Home') valor = PRECIO_MINIMO
    else if (e.key === 'End') valor = PRECIO_MAXIMO
    else return
    e.preventDefault()
    fijar(cual, valor)
  }

  // Si coinciden, queda por encima el que se pueda mover hacia donde hay sitio.
  const encimaMin = v.min === v.max ? (v.min >= PRECIO_MAXIMO ? true : v.min <= PRECIO_MINIMO ? false : ultimo === 'min') : ultimo === 'min'

  const tirador = (cual, valor) => (
    <div
      key={cual}
      data-tirador={cual}
      role="slider"
      tabIndex={0}
      aria-label={cual === 'min' ? 'Precio mínimo' : 'Precio máximo'}
      aria-orientation="horizontal"
      aria-valuemin={cual === 'min' ? PRECIO_MINIMO : v.min}
      aria-valuemax={cual === 'min' ? v.max : PRECIO_MAXIMO}
      aria-valuenow={valor}
      aria-valuetext={`${valor} euros`}
      onKeyDown={(e) => alTeclear(e, cual)}
      onFocus={() => setUltimo(cual)}
      style={{ left: `${pct(valor)}%`, zIndex: (cual === 'min') === encimaMin ? 3 : 2 }}
      className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-[3px] bg-white shadow-md outline-none transition-shadow active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 ${rango ? 'border-[#B5E600]' : 'border-[#C9D68A]'}`}
    />
  )

  return (
    <div className="w-full sm:w-72">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className={`${filtroLabelClass} mb-0 inline-flex items-center gap-1`}>
          <Euro className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Precio
        </label>
        <span aria-live="polite" className={`text-sm font-semibold ${rango ? 'text-[#3D4A00]' : 'text-[#6B7355]'}`}>
          {textoPrecioRango(rango)}
        </span>
      </div>

      <div
        onPointerDown={alPulsar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className="relative h-11 touch-none select-none px-3.5"
      >
        <div ref={pista} className="relative h-full">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#E2E6CF]" />
          <div
            className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${rango ? 'bg-[#B5E600]' : 'bg-[#DCE6A8]'}`}
            style={{ left: `${pct(v.min)}%`, width: `${pct(v.max) - pct(v.min)}%` }}
          />
          {tirador('min', v.min)}
          {tirador('max', v.max)}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-[11px] text-[#6B7355]">
        <span>{PRECIO_MINIMO} €</span>
        {rango ? (
          <button
            type="button"
            onClick={onRestablecer}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2} />
            Quitar filtro de precio
          </button>
        ) : (
          <span>Sin límite de precio</span>
        )}
        <span>{PRECIO_MAXIMO} €</span>
      </div>
    </div>
  )
}
