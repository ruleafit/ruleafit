'use client'

import { useEffect, useState } from 'react'

export default function BotonInstalarApp({ className }) {
  const [promptEvento, setPromptEvento] = useState(null)
  const [esIOS, setEsIOS] = useState(false)
  const [esMovil, setEsMovil] = useState(false)
  const [yaInstalada, setYaInstalada] = useState(false)
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)

  useEffect(() => {
    const userAgent = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(userAgent)
    const android = /Android/.test(userAgent)

    setEsIOS(iOS)
    setEsMovil(iOS || android)

    const instalada =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    setYaInstalada(instalada)

    function handleBeforeInstallPrompt(evento) {
      evento.preventDefault()
      setPromptEvento(evento)
    }

    function handleAppInstalled() {
      setYaInstalada(true)
      setPromptEvento(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handlePulsar() {
    if (promptEvento) {
      promptEvento.prompt()
      await promptEvento.userChoice
      setPromptEvento(null)
      return
    }

    if (esIOS) {
      setMostrarInstrucciones((valor) => !valor)
    }
  }

  if (!esMovil || yaInstalada || (!esIOS && !promptEvento)) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button type="button" onClick={handlePulsar} className={className}>
        Ten Openfit a mano
      </button>
      <p className="text-xs text-[#6B7355]">Sin descargar nada y en un segundo.</p>

      {esIOS && mostrarInstrucciones && (
        <div className="mt-2 max-w-xs rounded-xl border border-[#E2E6CF] bg-white p-5 text-left shadow-sm">
          <p className="text-sm font-bold text-[#1F2400]">Añadir a la pantalla de inicio</p>
          <ol className="mt-2 flex flex-col gap-2 text-sm text-[#1F2400]">
            <li>1. Toca el botón Compartir (el icono de cuadrado con flecha hacia arriba).</li>
            <li>2. Baja y toca &quot;Añadir a pantalla de inicio&quot;.</li>
            <li>3. Confirma con &quot;Añadir&quot;.</li>
          </ol>
        </div>
      )}
    </div>
  )
}
