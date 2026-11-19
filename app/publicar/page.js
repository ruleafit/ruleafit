'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import CabeceraPublicar from '../../components/publicar/CabeceraPublicar'
import BloqueQueVasADar from '../../components/publicar/BloqueQueVasADar'
import BloqueCuando from '../../components/publicar/BloqueCuando'
import BloqueDonde from '../../components/publicar/BloqueDonde'
import BloquePlazasPrecio from '../../components/publicar/BloquePlazasPrecio'
import MensajePublicar from '../../components/publicar/MensajePublicar'
import useFormularioPublicar from '../../components/publicar/useFormularioPublicar'
import { publicarSesion } from '../../components/publicar/enviarSesion'
import { botonPrimarioClass } from '../../components/publicar/constantes'

function PublicarFormulario() {
  const searchParams = useSearchParams()
  const copiarId = searchParams.get('copiar')

  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const campos = useFormularioPublicar(copiarId)

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user || null)
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  function handlePublicar(e) {
    e.preventDefault()
    return publicarSesion(campos, setMensaje)
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraPublicar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="corte-card border border-[#E2E6CF] bg-white p-6 text-sm text-[#6B7355] shadow-sm">
            Debes iniciar sesión para publicar. Ve a{' '}
            <a href="/login" className="font-semibold text-[#3D4A00] hover:underline">iniciar sesión</a>.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPublicar />

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <form onSubmit={handlePublicar} className="flex flex-col gap-6">
          <BloqueQueVasADar c={campos} />
          <BloqueCuando c={campos} />
          <BloqueDonde c={campos} />
          <BloquePlazasPrecio c={campos} />

          {/* Aviso pedido por el usuario el 12 sept 2026: recordar revisar
              los nombres de los inscritos antes de empezar la sesión.
              Mismo estilo que el aviso de cancelaciones en
              PreferenciasNotificaciones.js, pero en rojo para que
              destaque más. */}
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <span className="text-sm font-semibold text-red-700">
              Recuerda revisar los nombres antes de empezar la sesión en el apartado "Mis sesiones publicadas", para
              confirmar que todos los asistentes han reservado.
            </span>
          </div>

          <button type="submit" className={botonPrimarioClass}>
            Publicar sesión
          </button>
        </form>

        <MensajePublicar mensaje={mensaje} />
      </div>
    </div>
  )
}

export default function PublicarPage() {
  return (
    <Suspense fallback={null}>
      <PublicarFormulario />
    </Suspense>
  )
}
