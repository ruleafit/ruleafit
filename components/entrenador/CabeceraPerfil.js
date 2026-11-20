'use client'

import Link from 'next/link'
import { calcularNivel, calcularRango } from '../../lib/niveles'
import BotonSeguir from '../BotonSeguir'
import BotonFavorito from '../BotonFavorito'
import BotonDenunciar from '../BotonDenunciar'
import BotonBloquear from '../BotonBloquear'

export default function CabeceraPerfil({ perfil, clasesActivas, rulosSaldo, usuarioActual }) {
  const inicial = (perfil.username || '?').charAt(0).toUpperCase()
  const infoNivel = calcularNivel(rulosSaldo)
  const rango = calcularRango(infoNivel.nivel)

  return (
    <section className="relative flex flex-col items-center gap-3 bg-[#FBFAF3] px-4 pb-10 pt-14 text-center sm:pt-16">
      {/* Antes solo se podía volver al directorio desde el menú; pedido
          por el usuario el 11 sept 2026 al ver que se quedaba sin salida
          fácil al entrar en un perfil desde /entrenadores. */}
      <Link
        href="/entrenadores"
        className="absolute left-4 top-4 inline-flex items-center gap-1 corte-tag border border-[#1F2400]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition hover:border-[#B5E600] hover:text-[#1F2400] sm:left-6 sm:top-6"
      >
        ← Ruleros
      </Link>

      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-3xl font-extrabold text-[#1F2400] shadow-sm">
        {perfil.foto_url ? (
          <img src={perfil.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          inicial
        )}
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight text-[#1F2400] sm:text-3xl">
        @{perfil.username}
      </h1>

      <span className="inline-flex items-center corte-tag bg-[#EDF5C9] px-4 py-1.5 text-sm font-semibold text-[#3D4A00]">
        {clasesActivas} {clasesActivas === 1 ? 'sesión activa' : 'sesiones activas'}
      </span>

      {/* Nivel y rango público (pedido por el usuario el 12 sept 2026). */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center corte-tag bg-[#B5E600] px-3 py-1 text-xs font-bold text-[#1F2400]">
          Nivel {infoNivel.nivel}
        </span>
        <span className="inline-flex items-center gap-1 corte-tag bg-white px-3 py-1 text-xs font-bold text-[#3D4A00]">
          <span aria-hidden="true">{rango.icono}</span>
          {rango.nombre}
        </span>
      </div>

      {/* Dos acciones independientes: Seguir (social) y Favoritos (privado,
          sql/078). */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        <BotonSeguir entrenadorId={perfil.id} usuarioActual={usuarioActual} />
        <BotonFavorito favoritoId={perfil.id} usuarioActual={usuarioActual} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <BotonDenunciar
          tipo="usuario"
          objetivoId={perfil.id}
          usuarioDenunciadoId={perfil.id}
          usuarioActual={usuarioActual}
          etiqueta="Denunciar usuario"
        />
        <BotonBloquear usuarioId={perfil.id} username={perfil.username} usuarioActual={usuarioActual} />
      </div>
    </section>
  )
}
