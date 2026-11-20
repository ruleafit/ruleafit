'use client'

import Link from 'next/link'
import { Star, User, UserCheck } from 'lucide-react'
import { calcularNivel, calcularRango } from '../../lib/niveles'
import RevelarAlLlegar from '../RevelarAlLlegar'

// Tarjeta de rulero (la de siempre: foto, nombre, nivel, rango y
// descripción). `etiquetas` solo se pasa en los resultados de búsqueda, para
// ver de un vistazo si ya es favorito o lo sigues.
export default function TarjetaRulero({ rulero, indice, etiquetas }) {
  const inicial = (rulero.username || '?').charAt(0).toUpperCase()
  const infoNivel = calcularNivel(rulero.rulos_saldo)
  const rango = calcularRango(infoNivel.nivel)

  return (
    <RevelarAlLlegar delayMs={Math.min(indice * 60, 240)}>
      <Link
        href={`/entrenador/${rulero.username}`}
        className="tarjeta-hover flex h-full flex-col overflow-hidden corte-card border border-[#E2E6CF] bg-white shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-2xl font-extrabold text-[#1F2400] shadow-sm">
            {rulero.foto_url ? (
              <img src={rulero.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : rulero.username ? (
              inicial
            ) : (
              <User className="h-8 w-8" strokeWidth={1.75} />
            )}
          </div>

          <h2 className="text-lg font-bold text-[#1F2400]">@{rulero.username}</h2>

          {/* Nivel y rango (12 sept 2026): mismo cálculo que /cuenta, ver lib/niveles.js. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center corte-tag bg-[#B5E600] px-3 py-1 text-xs font-bold text-[#1F2400]">
              Nivel {infoNivel.nivel}
            </span>
            <span className="inline-flex items-center gap-1 corte-tag bg-[#FBFAF3] px-3 py-1 text-xs font-bold text-[#3D4A00]">
              <span aria-hidden="true">{rango.icono}</span>
              {rango.nombre}
            </span>
          </div>

          {etiquetas && (etiquetas.favorito || etiquetas.siguiendo) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {etiquetas.favorito && (
                <span className="inline-flex items-center gap-1 corte-tag border border-[#B5E600] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#3D4A00]">
                  <Star className="h-3 w-3" strokeWidth={1.75} fill="currentColor" />
                  Favorito
                </span>
              )}
              {etiquetas.siguiendo && (
                <span className="inline-flex items-center gap-1 corte-tag border border-[#E2E6CF] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#3D4A00]">
                  <UserCheck className="h-3 w-3" strokeWidth={1.75} />
                  Siguiendo
                </span>
              )}
            </div>
          )}

          <p className="line-clamp-3 text-sm text-[#6B7355]">
            {rulero.descripcion || 'Este rulero aún no ha completado su perfil.'}
          </p>
        </div>
      </Link>
    </RevelarAlLlegar>
  )
}
