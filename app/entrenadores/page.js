'use client'

import Link from 'next/link'
import useRuleros from '../../components/ruleros/useRuleros'
import ContenidoRuleros from '../../components/ruleros/ContenidoRuleros'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

export default function EntrenadoresPage() {
  const datos = useRuleros()

  if (datos.cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!datos.usuario) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-[#6B7355]">Inicia sesión para descubrir ruleros.</p>
        <Link href="/login" className={botonPrimarioClass}>
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[160px] items-end overflow-hidden sm:h-[200px]">
        <img src="/imagenes/comunidad.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-6 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ruleros</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            Descubre otros ruleros, entra en su perfil y añádelos a favoritos para enterarte de cuando publican una sesión.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {datos.error && <p className="mb-4 text-sm text-red-600">{datos.error}</p>}

        {!datos.error && datos.totalRuleros === 0 && (
          <p className="text-sm text-[#6B7355]">Todavía no hay ruleros disponibles.</p>
        )}

        {!datos.error && datos.totalRuleros > 0 && <ContenidoRuleros datos={datos} />}
      </div>
    </div>
  )
}
