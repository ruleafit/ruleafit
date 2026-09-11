'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Categorias desactivables (opt-out: ausencia de fila = activa). Las
// cancelaciones NO aparecen: son criticas y siempre se envian.
//
// Antes se elegía una lista de 4 según el rol guardado (cliente veía solo
// las de participante, entrenador solo las de organizador). Fase 7 de la
// unificación de roles (11 sept 2026): se muestran las 8 a la vez,
// agrupadas visualmente en dos bloques, porque un mismo usuario puede
// tener a la vez una reserva próxima y una sesión propia próxima.
const CATEGORIAS_PARTICIPANTE = [
  { clave: 'publicaciones',    etiqueta: 'Nuevas sesiones de usuarios que sigo' },
  { clave: 'recordatorio_24h', etiqueta: 'Recordatorio 24 horas antes' },
  { clave: 'recordatorio_7h',  etiqueta: 'Recordatorio 7 horas antes' },
  { clave: 'recordatorio_2h',  etiqueta: 'Recordatorio 2 horas antes' },
]
const CATEGORIAS_ORGANIZADOR = [
  { clave: 'recordatorio_24h_entrenador', etiqueta: 'Recordatorio 24 horas antes' },
  { clave: 'recordatorio_7h_entrenador',  etiqueta: 'Recordatorio 7 horas antes' },
  { clave: 'recordatorio_2h_entrenador',  etiqueta: 'Recordatorio 2 horas antes' },
  { clave: 'plazas_agotadas',             etiqueta: 'Aviso cuando mi sesión se llena' },
]
const TODAS_LAS_CATEGORIAS = [...CATEGORIAS_PARTICIPANTE, ...CATEGORIAS_ORGANIZADOR]

export default function PreferenciasNotificaciones({ usuarioActual, pushActivadas }) {
  const [activas, setActivas] = useState(() =>
    Object.fromEntries(TODAS_LAS_CATEGORIAS.map((c) => [c.clave, true]))
  )
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const { data } = await supabase
          .from('preferencias_notificaciones')
          .select('categoria, activo')
          .eq('usuario_id', usuarioActual.id)
        if (!vivo) return
        const estado = Object.fromEntries(TODAS_LAS_CATEGORIAS.map((c) => [c.clave, true]))
        if (data) {
          for (const fila of data) {
            if (fila.categoria in estado) estado[fila.categoria] = fila.activo
          }
        }
        setActivas(estado)
      } catch (e) {
        // si falla, todo queda en true (opt-out)
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => { vivo = false }
  }, [usuarioActual.id])

  async function alternar(clave) {
    if (guardando) return
    const nuevoValor = !activas[clave]
    setGuardando(clave)
    setError(null)
    setActivas((prev) => ({ ...prev, [clave]: nuevoValor }))
    try {
      const { error: errUpsert } = await supabase
        .from('preferencias_notificaciones')
        .upsert(
          { usuario_id: usuarioActual.id, categoria: clave, activo: nuevoValor, updated_at: new Date().toISOString() },
          { onConflict: 'usuario_id,categoria' }
        )
      if (errUpsert) {
        setActivas((prev) => ({ ...prev, [clave]: !nuevoValor }))
        setError('No se pudo guardar el cambio. Inténtalo de nuevo.')
      }
    } catch (e) {
      setActivas((prev) => ({ ...prev, [clave]: !nuevoValor }))
      setError('No se pudo guardar el cambio. Inténtalo de nuevo.')
    } finally {
      setGuardando(null)
    }
  }

  if (cargando) {
    return <p className="text-sm text-[#162318]/60">Cargando preferencias...</p>
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Aviso cuando push desactivadas - FUERA de la atenuacion, mas visible */}
      {!pushActivadas && (
        <p className="text-sm font-semibold text-[#3D4A00] mb-1">
          Activa las notificaciones arriba para elegir cuáles quieres recibir.
        </p>
      )}

      {/* SOLO los toggles se atenuan */}
      <div className={"flex flex-col gap-5" + (pushActivadas ? '' : ' opacity-50 pointer-events-none')}>
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Como participante</h4>
          {CATEGORIAS_PARTICIPANTE.map((cat) => (
            <div key={cat.clave} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#162318]">{cat.etiqueta}</span>
              <button
                onClick={() => alternar(cat.clave)}
                disabled={guardando === cat.clave || !pushActivadas}
                className={
                  (activas[cat.clave] ? 'bg-[#B5E600]' : 'bg-zinc-300') +
                  ' relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60'
                }
                aria-pressed={activas[cat.clave]}
              >
                <span
                  className={
                    (activas[cat.clave] ? 'translate-x-6' : 'translate-x-1') +
                    ' inline-block h-4 w-4 rounded-full bg-white transition'
                  }
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#E2E6CF] pt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Como entrenador / organizador</h4>
          {CATEGORIAS_ORGANIZADOR.map((cat) => (
            <div key={cat.clave} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#162318]">{cat.etiqueta}</span>
              <button
                onClick={() => alternar(cat.clave)}
                disabled={guardando === cat.clave || !pushActivadas}
                className={
                  (activas[cat.clave] ? 'bg-[#B5E600]' : 'bg-zinc-300') +
                  ' relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60'
                }
                aria-pressed={activas[cat.clave]}
              >
                <span
                  className={
                    (activas[cat.clave] ? 'translate-x-6' : 'translate-x-1') +
                    ' inline-block h-4 w-4 rounded-full bg-white transition'
                  }
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recuadro de cancelaciones - FUERA de la atenuacion, siempre a plena visibilidad */}
      <div className="mt-1 flex items-start gap-2 rounded-lg border-l-4 border-[#B5E600] bg-[#3D4A00]/5 px-3 py-2">
        <span className="text-sm font-semibold text-[#3D4A00]">
          Las notificaciones de cancelación siempre están activas debido a su importancia y no se pueden desactivar.
        </span>
      </div>

      {error && <p className="text-sm text-[#B85E60]">{error}</p>}
    </div>
  )
}
