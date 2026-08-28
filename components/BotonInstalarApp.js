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
    <div className="my-8 flex flex-col items-center gap-3 text-center">
      <button type="button" onClick={handlePulsar} className={className}>
        Ten Ruleafit a mano
      </button>
      <p className="text-xs text-[#6B7355]">Sin descargar nada y en un segundo.</p>

      {esIOS && mostrarInstrucciones && (
        <div className="mt-2 max-w-xs rounded-xl border border-[#E2E6CF] bg-white p-5 text-left shadow-sm">
          <p className="text-sm font-bold text-[#1F2400]">Añadir a la pantalla de inicio</p>
          <ol className="mt-2 flex flex-col gap-2 text-sm text-[#1F2400]">
            <li>
              1. Toca el botón de Compartir (el cuadrado con una flecha hacia arriba). Está en la barra de abajo
              o, si no lo ves, dentro del menú de los tres puntos &quot;···&quot; abajo a la derecha.
            </li>
            <li>2. Si no ves las opciones de compartir, toca &quot;Compartir&quot;.</li>
            <li>
              3. Busca &quot;Añadir a pantalla de inicio&quot;. Si no aparece, toca &quot;Ver más&quot; o desliza
              hacia abajo en la lista.
            </li>
            <li>4. Toca &quot;Añadir&quot; (arriba a la derecha).</li>
          </ol>
        </div>
      )}
    </div>
  )
}
