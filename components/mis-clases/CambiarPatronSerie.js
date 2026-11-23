'use client'

import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import EditorPatron from '../series/EditorPatron'
import {
  ahoraMadridTexto, diaSemanaIso, fechaValida, generarSesiones, normalizarHoras, validarSerie,
} from '../../lib/seriesSesiones'
import { inputClass, labelClass, ayudaClass } from '../publicar/constantes'

const hh = (h) => String(h).slice(0, 5)

// Patrón actual deducido de las sesiones futuras activas (refleja la realidad, no solo lo guardado).
function patronDesdeSesiones(futuras) {
  const porDia = {}
  for (const s of futuras) {
    const d = diaSemanaIso(s.clase_fecha)
    if (!porDia[d]) porDia[d] = new Set()
    porDia[d].add(hh(s.clase_hora))
  }
  const dias = Object.keys(porDia).map(Number).sort((a, b) => a - b)
  const horasPorDia = Object.fromEntries(dias.map((d) => [d, [...porDia[d]].sort()]))
  const todas = dias.map((d) => horasPorDia[d].join(','))
  const iguales = todas.every((t) => t === todas[0])
  return { dias, personalizado: !iguales, horas: iguales && dias.length ? horasPorDia[dias[0]] : [], horasPorDia }
}

// Cambiar los días y horas de una serie (solo sesiones futuras). Operación controlada: se añaden
// las sesiones nuevas, se cancelan las que sobran SOLO si no tienen reservas y las que tienen
// reservas se conservan sin tocar. Nunca se tocan las sesiones pasadas.
export default function CambiarPatronSerie({ serie, sesiones, m, onResultado }) {
  const ahora = ahoraMadridTexto()
  const hoy = ahora.slice(0, 10)
  const futuras = useMemo(
    () => sesiones.filter((s) => s.estado === 'activa' && !claseYaPaso({ fecha: s.clase_fecha, hora: s.clase_hora })),
    [sesiones]
  )
  const [patron, setPatron] = useState(() => patronDesdeSesiones(futuras))
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(() => futuras.reduce((mx, s) => (s.clase_fecha > mx ? s.clase_fecha : mx), hoy))
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  const calculo = useMemo(() => {
    const validacion = validarSerie({ patron, inicio: desde, fin: hasta, duracion: null, ahora })
    const existentes = futuras.map((s) => ({ fecha: s.clase_fecha, hora: hh(s.clase_hora), reservas: s.alumnos.length, id: s.clase_id }))
    // Las sesiones futuras anteriores a «Aplicar desde» se conservan tal cual.
    const antes = existentes.filter((e) => e.fecha < desde).map((e) => ({ fecha: e.fecha, hora: e.hora }))
    const deseadas = fechaValida(desde) && fechaValida(hasta) ? [...antes, ...validacion.sesiones] : []
    const claveDeseada = new Set(deseadas.map((s) => `${s.fecha} ${s.hora}`))
    const claveExistente = new Set(existentes.map((e) => `${e.fecha} ${e.hora}`))
    const aAnadir = deseadas.filter((s) => !claveExistente.has(`${s.fecha} ${s.hora}`))
    const sobran = existentes.filter((e) => !claveDeseada.has(`${e.fecha} ${e.hora}`))
    return {
      validacion,
      deseadas,
      anadir: aAnadir.length,
      cancelar: sobran.filter((e) => e.reservas === 0).length,
      conservar: sobran.filter((e) => e.reservas > 0).length,
    }
  }, [patron, desde, hasta, futuras, ahora])

  const hayCambios = calculo.anadir > 0 || calculo.cancelar > 0
  const errores = calculo.validacion.errores

  async function aplicar() {
    const resumen = [
      calculo.anadir > 0 ? `añadir ${calculo.anadir}` : '',
      calculo.cancelar > 0 ? `cancelar ${calculo.cancelar} (sin reservas)` : '',
    ].filter(Boolean).join(' y ')
    if (!window.confirm(`Se van a ${resumen} sesiones. ${calculo.conservar > 0 ? `Las ${calculo.conservar} sesiones con reservas que ya no encajan se conservan. ` : ''}¿Continuar?`)) return
    setProcesando(true)
    setError('')
    const patronGuardado = {
      version: 1,
      dias: [...patron.dias].sort((a, b) => a - b),
      personalizado: !!patron.personalizado,
      horas: normalizarHoras(patron.horas),
      horasPorDia: Object.fromEntries(Object.entries(patron.horasPorDia || {}).map(([k, v]) => [k, normalizarHoras(v)])),
      inicio: desde,
      fin: hasta,
    }
    const { data, error: e } = await supabase.rpc('actualizar_patron_serie', {
      p_serie_id: serie.id,
      p_sesiones: calculo.deseadas,
      p_patron: patronGuardado,
    })
    setProcesando(false)
    if (e) {
      setError(e.message)
      return
    }
    const partes = []
    if (data.anadidas > 0) partes.push(`${data.anadidas} ${data.anadidas === 1 ? 'sesión añadida' : 'sesiones añadidas'}`)
    if (data.canceladas > 0) partes.push(`${data.canceladas} ${data.canceladas === 1 ? 'cancelada' : 'canceladas'} (sin reservas)`)
    if (data.conservadas_con_reservas > 0) partes.push(`${data.conservadas_con_reservas} conservadas por tener reservas`)
    onResultado(partes.length ? `Serie actualizada: ${partes.join(', ')}.` : 'La serie ya estaba así; no se ha cambiado nada.')
    m.recargar()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[#6B7355]">
        Solo afecta a sesiones futuras. Las que ya tienen reservas nunca se cancelan ni se mueven aquí, y las pasadas no se tocan.
      </p>

      <EditorPatron patron={patron} onChange={setPatron} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Aplicar desde</label>
          <input type="date" value={desde} min={hoy} onChange={(e) => setDesde(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Repetir hasta</label>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={inputClass} />
          <p className={ayudaClass}>Se incluye esa fecha si es uno de los días elegidos.</p>
        </div>
      </div>

      {errores.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm font-medium text-red-700">
          {errores.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : (
        <p className="corte-card border border-[#E2E6CF] bg-[#FBFAF3] px-3 py-2 text-sm text-[#1F2400]">
          {hayCambios || calculo.conservar > 0 ? (
            <>
              {calculo.anadir > 0 && <span className="block">Se añadirán <b>{calculo.anadir}</b> sesiones nuevas.</span>}
              {calculo.cancelar > 0 && <span className="block">Se cancelarán <b>{calculo.cancelar}</b> sesiones sin reservas.</span>}
              {calculo.conservar > 0 && (
                <span className="block text-amber-800">
                  Se conservarán <b>{calculo.conservar}</b> sesiones con reservas aunque ya no encajen en el patrón.
                </span>
              )}
            </>
          ) : (
            'Sin cambios respecto al patrón actual.'
          )}
        </p>
      )}

      {error && <p className="text-sm font-medium text-red-700 [overflow-wrap:anywhere]">{error}</p>}

      <button
        type="button"
        onClick={aplicar}
        disabled={procesando || errores.length > 0 || !hayCambios}
        className="self-end corte-btn bg-[#B5E600] px-5 py-2 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {procesando ? 'Aplicando…' : 'Aplicar cambios'}
      </button>
    </div>
  )
}
