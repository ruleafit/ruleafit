'use client'

import { useEffect } from 'react'

export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.error('Error registrando el service worker:', err)
      })
    }
  }, [])

  return null
}
