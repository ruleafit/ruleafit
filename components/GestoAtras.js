'use client'

import { useEffect, useRef } from 'react'
import { usaGestosPropios, vibrar } from '../lib/nativo'

// Deslizar desde el borde izquierdo hacia la derecha = volver atrás.
//
// Solo se activa donde el sistema no lo hace ya:
// - dentro de la app de iPhone (la vista web de Capacitor no trae ese gesto);
// - en la web instalada en la pantalla de inicio del iPhone (no tiene barra
//   de navegador ni gesto de atrás).
// En Safari normal y en Android (que ya tiene su gesto de atrás) no hace nada,
// para no volver dos páginas de golpe.
//
// Si algún día se activa el gesto nativo de WKWebView
// (allowsBackForwardNavigationGestures), hay que quitar este componente.

const ZONA_BORDE = 24 // px desde el borde izquierdo donde puede empezar el gesto
const DISTANCIA_MINIMA = 90 // px de recorrido horizontal para que cuente
const DESVIO_MAXIMO = 60 // px de movimiento vertical tolerado
const RECORRIDO_VISUAL = 64 // px que se mueve la flecha como máximo

function puedeVolver() {
  return window.location.pathname !== '/' && window.history.length > 1
}

// No se interfiere con el mapa ni con lo que se desplaza en horizontal o se escribe.
function empiezaEnZonaProtegida(objetivo) {
  if (!(objetivo instanceof Element)) return false
  if (objetivo.closest('input, textarea, select, [contenteditable="true"], .leaflet-container, [data-sin-gesto-atras]')) {
    return true
  }
  for (let el = objetivo; el && el !== document.body; el = el.parentElement) {
    const { overflowX } = window.getComputedStyle(el)
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true
  }
  return false
}

export default function GestoAtras() {
  const indicador = useRef(null)

  useEffect(() => {
    let inicio = null // { x, y } mientras hay un gesto en curso

    function pintar(dx) {
      const el = indicador.current
      if (!el) return
      const avance = Math.min(Math.max(dx, 0), RECORRIDO_VISUAL * 2) / 2
      const listo = dx >= DISTANCIA_MINIMA
      el.style.opacity = dx > 8 ? '1' : '0'
      el.style.transform = `translate(${avance - RECORRIDO_VISUAL}px, -50%) scale(${listo ? 1.1 : 1})`
      el.style.background = listo ? '#B5E600' : 'rgba(31,36,0,0.75)'
      el.style.color = listo ? '#1F2400' : '#ffffff'
    }

    function ocultar() {
      const el = indicador.current
      if (!el) return
      el.style.opacity = '0'
      el.style.transform = `translate(-${RECORRIDO_VISUAL}px, -50%)`
    }

    function alTocar(e) {
      inicio = null
      if (e.touches.length !== 1 || !usaGestosPropios() || !puedeVolver()) return
      const toque = e.touches[0]
      if (toque.clientX > ZONA_BORDE || empiezaEnZonaProtegida(e.target)) return
      inicio = { x: toque.clientX, y: toque.clientY }
    }

    function alMover(e) {
      if (!inicio) return
      const toque = e.touches[0]
      const dx = toque.clientX - inicio.x
      const dy = Math.abs(toque.clientY - inicio.y)
      if (dy > DESVIO_MAXIMO && dy > dx) {
        inicio = null
        ocultar()
        return
      }
      pintar(dx)
    }

    function alSoltar(e) {
      if (!inicio) return
      const toque = e.changedTouches[0]
      const dx = toque.clientX - inicio.x
      const dy = Math.abs(toque.clientY - inicio.y)
      inicio = null
      ocultar()
      if (dx >= DISTANCIA_MINIMA && dy <= DESVIO_MAXIMO) {
        vibrar('ligero')
        window.history.back()
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
        left: 0,
        top: '50%',
        zIndex: 60,
        width: 44,
        height: 44,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: 0,
        transform: `translate(-${RECORRIDO_VISUAL}px, -50%)`,
        transition: 'opacity 150ms ease, background 150ms ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    </div>
  )
}
