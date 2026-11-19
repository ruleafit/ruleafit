'use client'

import { useEffect, useState } from 'react'

// Desplazamiento vertical (en px) de la imagen de portada al hacer scroll.
// Es 0 si el usuario prefiere menos movimiento.
export default function useParallax() {
  const [scrollY, setScrollY] = useState(0)
  const [prefiereMenosMovimiento, setPrefiereMenosMovimiento] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefiereMenosMovimiento(media.matches)

    if (media.matches) return

    let frame = null
    function alHacerScroll() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        setScrollY(window.scrollY)
        frame = null
      })
    }
    window.addEventListener('scroll', alHacerScroll)
    return () => window.removeEventListener('scroll', alHacerScroll)
  }, [])

  return prefiereMenosMovimiento ? 0 : Math.min(scrollY * 0.2, 80)
}
