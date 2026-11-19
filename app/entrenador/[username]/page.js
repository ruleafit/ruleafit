'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SearchX } from 'lucide-react'
import usePerfilEntrenador from '../../../components/entrenador/usePerfilEntrenador'
import CabeceraPerfil from '../../../components/entrenador/CabeceraPerfil'
import BonosEntrenador from '../../../components/entrenador/BonosEntrenador'
import ValoracionesEntrenador from '../../../components/entrenador/ValoracionesEntrenador'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

export default function PerfilEntrenadorPage() {
  const { username } = useParams()
  const datos = usePerfilEntrenador(username)
  const { perfil, usuarioActual } = datos

  if (datos.cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (datos.noEncontrado) {
    return (
      <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <SearchX className="h-12 w-12 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">Rulero no encontrado.</p>
        <Link href="/clases" className={botonPrimarioClass}>
          Volver a sesiones
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPerfil
        perfil={perfil}
        clasesActivas={datos.clasesActivas}
        rulosSaldo={datos.rulosSaldo}
        usuarioActual={usuarioActual}
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="corte-card border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
            Sobre @{perfil.username}
          </h2>
          <p className="text-sm text-[#1F2400]">
            {perfil.descripcion || 'Este rulero aún no ha completado su perfil.'}
          </p>
        </div>

        <BonosEntrenador perfil={perfil} bonos={datos.bonosOfrecidos} usuarioActual={usuarioActual} />

        <ValoracionesEntrenador
          perfil={perfil}
          usuarioActual={usuarioActual}
          promedioEstrellas={datos.promedioEstrellas}
          totalValoraciones={datos.totalValoraciones}
          puedeValorar={datos.puedeValorar}
          valoracionPropia={datos.valoracionPropia}
          onValoracionGuardada={datos.recargarValoraciones}
        />

        <div className="mt-8 text-center">
          <Link
            href="/clases"
            className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
          >
            Ver todas las sesiones
          </Link>
        </div>
      </div>
    </div>
  )
}
