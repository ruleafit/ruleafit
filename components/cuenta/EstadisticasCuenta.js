'use client'

import Link from 'next/link'
import { Coins, CalendarCheck, Star, Users } from 'lucide-react'
import RevelarAlLlegar from '../RevelarAlLlegar'

export default function EstadisticasCuenta({
  username,
  rulosSaldo,
  sesionesParticipante,
  sesionesOrganizador,
  numClasesOrganizadasTotal,
  promedioValoraciones,
  totalValoraciones,
  numSeguidores,
}) {
  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevelarAlLlegar className="flex items-center gap-4 corte-card border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <Coins className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{rulosSaldo}</p>
            <p className="text-sm font-semibold text-[#3D4A00]">Rulos acumulados</p>
          </div>
        </RevelarAlLlegar>

        {/* Antes un único contador "Sesiones realizadas" que se calculaba
            de una forma u otra según el rol. Fase 7 de la unificación de
            roles (11 sept 2026): se muestran siempre los dos, porque un
            mismo usuario puede haber participado en unas y organizado
            otras. */}
        <RevelarAlLlegar className="flex items-center gap-4 corte-card border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <CalendarCheck className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{sesionesParticipante}</p>
            <p className="text-sm font-semibold text-[#3D4A00]">Sesiones en las que has participado</p>
          </div>
        </RevelarAlLlegar>

        <RevelarAlLlegar className="flex items-center gap-4 corte-card border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <CalendarCheck className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{sesionesOrganizador}</p>
            <p className="text-sm font-semibold text-[#3D4A00]">Sesiones que has organizado</p>
          </div>
        </RevelarAlLlegar>
      </div>

      {/* Valoraciones: antes solo visible con rol "entrenador". Fase 7 de
          la unificación de roles (11 sept 2026): siempre visible, con un
          mensaje distinto si el usuario nunca ha organizado ninguna
          sesión (no puede tener valoraciones todavía) frente a si ya
          organiza pero nadie le ha valorado aún. */}
      <RevelarAlLlegar className="mb-8 flex flex-wrap items-center justify-between gap-4 corte-card border border-[#E2E6CF] bg-[#EDF5C9] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <Star className="h-7 w-7 text-[#B5E600]" fill="#B5E600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">
              {promedioValoraciones !== null ? promedioValoraciones.toFixed(1).replace('.', ',') : '—'}
            </p>
            <p className="text-sm font-semibold text-[#3D4A00]">
              {totalValoraciones === 0
                ? numClasesOrganizadasTotal === 0
                  ? 'Todavía no has organizado ninguna sesión'
                  : 'Sin valoraciones todavía'
                : totalValoraciones === 1
                  ? '(1 valoración)'
                  : `(${totalValoraciones} valoraciones)`}
            </p>
          </div>
        </div>

        {totalValoraciones > 0 && username && (
          <Link
            href={`/entrenador/${username}/opiniones`}
            className="corte-btn border border-[#3D4A00] px-4 py-2 text-sm font-bold text-[#3D4A00] transition hover:bg-[#3D4A00] hover:text-white"
          >
            Ver opiniones
          </Link>
        )}
      </RevelarAlLlegar>

      <RevelarAlLlegar className="mb-8 flex items-center gap-4 corte-card border border-[#E2E6CF] bg-[#EDF5C9] p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
          <Users className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{numSeguidores}</p>
          <p className="text-sm font-semibold text-[#3D4A00]">
            {numSeguidores === 1 ? 'usuario te sigue' : 'usuarios te siguen'}
          </p>
        </div>
      </RevelarAlLlegar>
    </>
  )
}
