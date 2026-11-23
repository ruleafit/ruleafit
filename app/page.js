'use client'

import { claseYaPaso } from '../lib/ventanaEdicionClase'
import BotonInstalarApp from '../components/BotonInstalarApp'
import useDatosHome from '../components/home/useDatosHome'
import useParallax from '../components/home/useParallax'
import HeroHome from '../components/home/HeroHome'
import ProximasSesionesReservas from '../components/home/ProximasSesionesReservas'
import CategoriasHome from '../components/home/CategoriasHome'
import CaptacionEntrenadores from '../components/home/CaptacionEntrenadores'
import GuiaOrganizador from '../components/home/GuiaOrganizador'
import BannerComunidad from '../components/home/BannerComunidad'
import PuntosHome from '../components/home/PuntosHome'
import { botonPrimarioClass } from '../components/home/constantes'

export default function Home() {
  const datos = useDatosHome()
  const desplazamientoParallax = useParallax()
  const { usuario, misClases, misReservas } = datos

  if (datos.cargandoSesion) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  // Fase 3 de la unificación de roles (11 sept 2026): estas cifras ya no
  // dependen del rol guardado, sino de si el propio usuario tiene sesiones
  // publicadas (misClases, ahora pedido para cualquier logueado).
  const tieneClasesPublicadas = (misClases || []).length > 0

  const clasesActivasAhora = (misClases || [])
    .filter((c) => c.estado === 'activa')
    .filter((c) => !claseYaPaso({ fecha: c.fecha, hora: c.hora }))

  const proximasReservasPropias = (misReservas || [])
    .filter((r) => r.clases && !claseYaPaso({ fecha: r.clases.fecha, hora: r.clases.hora }))
    .sort((a, b) => {
      const claveA = `${a.clases.fecha} ${String(a.clases.hora).slice(0, 5)}`
      const claveB = `${b.clases.fecha} ${String(b.clases.hora).slice(0, 5)}`
      return claveA < claveB ? -1 : 1
    })

  return (
    <div className="flex flex-1 flex-col">
      <HeroHome usuario={usuario} username={datos.username} desplazamientoParallax={desplazamientoParallax} />

      <div className="solo-web">
        <BotonInstalarApp className={botonPrimarioClass} />
      </div>

      {usuario && !datos.cargandoMisClases && <GuiaOrganizador usuario={usuario} misClases={misClases} />}

      {usuario && !datos.cargandoMisClases && !datos.cargandoMisReservas && (
        <ProximasSesionesReservas
          clasesActivasAhora={clasesActivasAhora}
          proximasReservasPropias={proximasReservasPropias}
        />
      )}

      {/* Categorías: no se muestran a quien ya tiene sesiones propias publicadas */}
      {!datos.cargandoMisClases && !tieneClasesPublicadas && <CategoriasHome />}

      {/* Captación de entrenadores (solo visible sin sesión) */}
      {!usuario && <CaptacionEntrenadores />}

      <BannerComunidad tieneClasesPublicadas={tieneClasesPublicadas} />

      <PuntosHome />
    </div>
  )
}
