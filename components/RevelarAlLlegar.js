'use client'

import { useEffect, useRef, useState } from 'react'

export default function RevelarAlLlegar({ children, className = '', as: Componente = 'div', delayMs = 0 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const nodo = ref.current
    if (!nodo) return

    const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefiereMenosMovimiento) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0].isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(nodo)
    return () => observer.disconnect()
  }, [])

  return (
    <Componente
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Componente>
  )
}
