'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ClipboardList, CircleAlert } from 'lucide-react'
import CalendarioSesiones from '../CalendarioSesiones'
import BarraDiaCalendario from '../BarraDiaCalendario'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../RevelarAlLlegar'
import TituloBloque from '../publicar/TituloBloque'
import TarjetaMisClase from './TarjetaMisClase'
import SerieMisClases from './SerieMisClases'
import { claveFechaHora } from './datos'

// m = useMisClases.
export default function ListaMisClases({ m }) {
  const { error, clasesConAlumnos } = m

  // Series de sesiones recurrentes (C07): sus sesiones se agrupan en UNA tarjeta por serie; las
  // sesiones individuales se muestran como siempre. (Sin datos de la serie, se tratan como sueltas.)
  const esDeSerie = (c) => !!(c.serie_id && m.series?.[c.serie_id])
  const sesionesPorSerie = {}
  for (const c of clasesConAlumnos) {
    if (esDeSerie(c)) (sesionesPorSerie[c.serie_id] ||= []).push(c)
  }
  const individuales = clasesConAlumnos.filter((c) => !esDeSerie(c))
  const futura = (c) => !claseYaPaso({ fecha: c.clase_fecha, hora: c.clase_hora }) && c.estado !== 'cancelada'
  const proximaDe = (lista) => lista.filter(futura).map(claveFechaHora).sort()[0]
  const seriesConFuturas = Object.keys(sesionesPorSerie)
    .filter((id) => sesionesPorSerie[id].some(futura))
    .sort((a, b) => (proximaDe(sesionesPorSerie[a]) < proximaDe(sesionesPorSerie[b]) ? -1 : 1))
  const seriesSinFuturas = Object.keys(sesionesPorSerie).filter((id) => !sesionesPorSerie[id].some(futura))

  const clasesProximas = individuales
    .filter((c) => !claseYaPaso({ fecha: c.clase_fecha, hora: c.clase_hora }) && c.estado !== 'cancelada')
    .sort((a, b) => (claveFechaHora(a) < claveFechaHora(b) ? -1 : 1))

  const clasesPasadas = individuales
    .filter((c) => claseYaPaso({ fecha: c.clase_fecha, hora: c.clase_hora }))
    .sort((a, b) => (claveFechaHora(a) > claveFechaHora(b) ? -1 : 1))

  // Lista de «Próximas»: sesiones sueltas y series mezcladas por su próxima fecha.
  const elementosProximos = [
    ...clasesProximas.map((c) => ({ tipo: 'clase', clave: claveFechaHora(c), c })),
    ...seriesConFuturas.map((id) => ({ tipo: 'serie', clave: proximaDe(sesionesPorSerie[id]), id })),
  ].sort((a, b) => (a.clave < b.clave ? -1 : 1))

  const clasesRealizadas = clasesConAlumnos.filter(
    (c) => c.estado !== 'cancelada' && claseYaPaso({ fecha: c.clase_fecha, hora: c.clase_hora })
  ).length

  // Calendario: días con sesiones futuras activas en lima. Con un día elegido
  // solo se listan las sesiones de esa fecha (por hora); las ya empezadas de
  // hoy salen atenuadas y sin botón de cancelar (lo decide TarjetaMisClase).
  const [diaSel, setDiaSel] = useState(null)
  const diasConSesiones = new Set(clasesConAlumnos.filter(futura).map((c) => c.clase_fecha))
  const clasesDelDia = diaSel
    ? clasesConAlumnos
        .filter((c) => c.clase_fecha === diaSel)
        .sort((a, b) => (claveFechaHora(a) < claveFechaHora(b) ? -1 : 1))
    : []

  function tarjeta(clase, indice, atenuada) {
    return (
      <TarjetaMisClase
        key={clase.clase_id}
        clase={clase}
        indice={indice}
        atenuada={atenuada}
        procesandoCancelacion={m.procesandoCancelacionId === clase.clase_id}
        mensajeCancelacion={m.mensajesCancelacion[clase.clase_id]}
        errorCancelacion={m.erroresCancelacion[clase.clase_id]}
        onCancelar={m.handleCancelarClase}
      />
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 flex items-start gap-2 corte-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {!error && clasesConAlumnos.length === 0 && (
        <RevelarAlLlegar className="flex flex-col items-center gap-3 corte-card border border-[#E2E6CF] bg-white px-6 py-14 text-center">
          <ClipboardList className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
          <p className="text-sm text-[#6B7355]">Todavía no has publicado ninguna sesión.</p>
          <Link
            href="/publicar"
            className="mt-1 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Publicar una sesión
          </Link>
        </RevelarAlLlegar>
      )}

      {!error && clasesConAlumnos.length > 0 && (
        <>
          <CalendarioSesiones
            diasConSesiones={diasConSesiones}
            seleccionado={diaSel}
            onSeleccionar={setDiaSel}
          />

          <TituloBloque Icono={ClipboardList}>Tus sesiones</TituloBloque>

          {diaSel && <BarraDiaCalendario fecha={diaSel} onVerTodas={() => setDiaSel(null)} />}

          {diaSel && clasesDelDia.length === 0 && (
            <p className="corte-card border border-[#E2E6CF] bg-white px-4 py-6 text-center text-sm text-[#6B7355]">
              No hay sesiones para esta fecha.
            </p>
          )}

          <div className="flex flex-col gap-5">
            {diaSel
              ? clasesDelDia.map((clase, indice) =>
                  tarjeta(clase, indice, claseYaPaso({ fecha: clase.clase_fecha, hora: clase.clase_hora }))
                )
              : elementosProximos.map((el, indice) =>
                  el.tipo === 'serie' ? (
                    <SerieMisClases key={el.id} serie={m.series[el.id]} sesiones={sesionesPorSerie[el.id]} m={m} />
                  ) : (
                    tarjeta(el.c, indice, false)
                  )
                )}
          </div>

          {!diaSel && clasesPasadas.length + seriesSinFuturas.length > 0 && (
            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between border-b border-[#E2E6CF] pb-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Historial</h2>
                <span className="text-xs text-[#6B7355]">
                  {clasesRealizadas} {clasesRealizadas === 1 ? 'sesión realizada' : 'sesiones realizadas'}
                </span>
              </div>

              <div className="flex flex-col gap-5">
                {seriesSinFuturas.map((id) => (
                  <SerieMisClases key={id} serie={m.series[id]} sesiones={sesionesPorSerie[id]} m={m} />
                ))}
                {clasesPasadas.map((clase, indice) => tarjeta(clase, indice, true))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
