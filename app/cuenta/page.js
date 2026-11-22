'use client'

import Link from 'next/link'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { calcularNivel, calcularRango } from '../../lib/niveles'
import PerfilFiscal from '../../components/PerfilFiscal'
import UsuariosBloqueados from '../../components/UsuariosBloqueados'
import EliminarCuenta from '../../components/EliminarCuenta'
import useDatosCuenta from '../../components/cuenta/useDatosCuenta'
import CabeceraCuenta from '../../components/cuenta/CabeceraCuenta'
import PerfilCuenta from '../../components/cuenta/PerfilCuenta'
import EstadisticasCuenta from '../../components/cuenta/EstadisticasCuenta'
import MovimientosRulos from '../../components/cuenta/MovimientosRulos'
import NotificacionesCuenta from '../../components/cuenta/NotificacionesCuenta'
import BloqueDesplegable from '../../components/cuenta/BloqueDesplegable'

export default function CuentaPage() {
  const datos = useDatosCuenta()
  const { usuario, setUsuario, cargando, username, fotoUrl, rulosSaldo } = datos

  async function cerrarSesion() {
    const confirmado = window.confirm('¿Estás seguro de que quieres cerrar sesión?')
    if (!confirmado) return

    await supabase.auth.signOut()
    setUsuario(null)
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
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-[#6B7355]">
          No has iniciado sesión. Ve a{' '}
          <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">
            iniciar sesión
          </Link>
          .
        </p>
      </div>
    )
  }

  const inicial = (username || usuario.email || '?').charAt(0).toUpperCase()
  const infoNivel = calcularNivel(rulosSaldo)
  const rango = calcularRango(infoNivel.nivel)

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraCuenta
        fotoUrl={fotoUrl}
        username={username}
        email={usuario.email}
        inicial={inicial}
        infoNivel={infoNivel}
        rango={rango}
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <BloqueDesplegable id="tu-perfil" titulo="Tu perfil" abiertoInicial>
          <PerfilCuenta
            usuario={usuario}
            username={username}
            setUsername={datos.setUsername}
            descripcionInicial={datos.descripcionPerfil}
            fotoUrl={fotoUrl}
            setFotoUrl={datos.setFotoUrl}
            inicial={inicial}
          />

          <PerfilFiscal usuario={usuario} />

          <UsuariosBloqueados usuario={usuario} />
        </BloqueDesplegable>

        <BloqueDesplegable id="estadisticas" titulo="Estadísticas y valoraciones">
          <EstadisticasCuenta {...datos} />
        </BloqueDesplegable>

        <NotificacionesCuenta usuario={usuario} />

        <BloqueDesplegable id="mis-rulos" titulo="Mis últimos Rulos" icono={History}>
          <MovimientosRulos movimientos={datos.rulosMovimientos} motivos={datos.rulosMotivos} />
        </BloqueDesplegable>

        <div className="mt-8" />

        <EliminarCuenta usuario={usuario} />

        <button
          type="button"
          onClick={cerrarSesion}
          className="inline-flex w-full items-center justify-center corte-btn bg-[#1F2400] px-6 py-3 text-sm font-bold text-white transition hover:bg-black sm:w-auto"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
