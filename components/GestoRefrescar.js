'use client'

import { useEffect, useRef } from 'react'
import { usaGestosPropios, vibrar } from '../lib/nativo'

// Tirar hacia abajo desde lo alto de la página = recargar (listas de sesiones,
// reservas, etc.). Solo donde el sistema no lo trae ya: ver usaGestosPropios().

const DISTANCIA_MINIMA = 80 // px de arrastre para que cuente
const ZONA_BORDE = 24 // el borde izquierdo se reserva al gesto de volver atrás
const RECORRIDO_VISUAL = 90

// No se interfiere con el mapa, los campos de texto ni los bloques que se
// desplazan por dentro (si no están ya arriba del todo).
function empiezaEnZonaProtegida(objetivo) {
  if (!(objetivo instanceof Element)) return false
  if (objetivo.closest('input, textarea, select, [contenteditable="true"], .leaflet-container, [data-sin-gesto-refrescar]')) {
    return true
  }
  for (let el = objetivo; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = window.getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
      return true
    }
  }
  return false
}

export default function GestoRefrescar() {
  const indicador = useRef(null)

  useEffect(() => {
    let inicio = null // { x, y } mientras hay un gesto en curso
    let recargando = false

    function pintar(dy) {
      const el = indicador.current
      if (!el) return
      const avance = Math.min(dy, RECORRIDO_VISUAL * 2) / 2
      const listo = dy >= DISTANCIA_MINIMA
      el.style.opacity = dy > 8 ? '1' : '0'
      el.style.transform = `translate(-50%, ${avance - RECORRIDO_VISUAL / 2}px) rotate(${listo ? 180 : Math.min(dy, DISTANCIA_MINIMA) * 2}deg)`
      el.style.background = listo ? '#B5E600' : 'rgba(31,36,0,0.75)'
      el.style.color = listo ? '#1F2400' : '#ffffff'
    }

    function ocultar() {
      const el = indicador.current
      if (!el) return
      el.style.opacity = '0'
      el.style.transform = `translate(-50%, -${RECORRIDO_VISUAL}px)`
    }

    function alTocar(e) {
      inicio = null
      if (recargando || e.touches.length !== 1 || !usaGestosPropios()) return
      const arriba = (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
      const toque = e.touches[0]
      if (!arriba || toque.clientX <= ZONA_BORDE || empiezaEnZonaProtegida(e.target)) return
      inicio = { x: toque.clientX, y: toque.clientY }
    }

    function alMover(e) {
      if (!inicio) return
      const toque = e.touches[0]
      const dy = toque.clientY - inicio.y
      const dx = Math.abs(toque.clientX - inicio.x)
      // Hacia arriba, o más horizontal que vertical: no es este gesto.
      if (dy < 0 || dx > dy) {
        inicio = null
        ocultar()
        return
      }
      pintar(dy)
    }

    function alSoltar(e) {
      if (!inicio) return
      const dy = e.changedTouches[0].clientY - inicio.y
      inicio = null
      if (dy >= DISTANCIA_MINIMA) {
        recargando = true
        vibrar('ligero')
        const el = indicador.current
        if (el) {
          el.style.opacity = '1'
          el.style.transform = `translate(-50%, 24px)`
        }
        window.location.reload()
      } else {
        ocultar()
      }
    }

    function alCancelar() {
      inicio = null
      ocultar()
    }

    document.addEventListener('touchstart', alTocar, { passive: true })
    document.addEventListener('touchmove', alMover, { passive: true })
    document.addEventListener('touchend', alSoltar, { passive: true })
    document.addEventListener('touchcancel', alCancelar, { passive: true })
    return () => {
      document.removeEventListener('touchstart', alTocar)
      document.removeEventListener('touchmove', alMover)
      document.removeEventListener('touchend', alSoltar)
      document.removeEventListener('touchcancel', alCancelar)
    }
  }, [])

  return (
    <div
      ref={indicador}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '50%',
        top: 'env(safe-area-inset-top, 0px)',
        zIndex: 60,
        width: 40,
        height: 40,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: 0,
        transform: `translate(-50%, -${RECORRIDO_VISUAL}px)`,
        transition: 'opacity 150ms ease, background 150ms ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    </div>
  )
}
