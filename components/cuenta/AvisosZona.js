'use client'

import { useEffect, useState } from 'react'
import { MapPin, Check, CircleAlert, CircleCheck } from 'lucide-react'
import BuscadorDireccion from '../BuscadorDireccion'
import { CATEGORIAS } from '../publicar/constantes'
import { esApp } from '../../lib/nativo'
import useAvisosZona, { RADIOS_KM } from './useAvisosZona'

// «Avisos de sesiones en mi zona»: solo configuración (Fase 2). Se guarda en
// public.avisos_zona. Este bloque NO lleva la clase solo-web a propósito: se ve
// también en la app de iPhone aunque allí aún no haya push nativo.

// Horas de 30 en 30 minutos. "Hasta" termina en 23:59 (fin del día).
const HORAS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  return `${h}:${i % 2 === 0 ? '00' : '30'}`
})
const HORAS_DESDE = HORAS
const HORAS_HASTA = [...HORAS.slice(1), '23:59']

const MODOS = [
  {
    clave: 'diario',
    titulo: 'Resumen diario',
    detalle: 'Un solo aviso al día, a las 20:30 (hora de Madrid), con las sesiones nuevas que encajan contigo.',
  },
  {
    clave: 'inmediato',
    titulo: 'Inmediata',
    detalle:
      'Te avisamos cuando se publica una sesión que encaja. Máximo un aviso por organizador al día y cinco avisos inmediatos al día.',
  },
]

const etiquetaClass = 'text-xs font-semibold uppercase tracking-wide text-[#6B7355]'
const enfoqueClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

function SelectorHora({ id, etiqueta, valor, opciones, onChange }) {
  // Si el valor guardado no estuviera en la lista, se añade para mostrarlo tal cual.
  const lista = opciones.includes(valor) ? opciones : [...opciones, valor].sort()
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-[#162318]">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full corte-btn border-2 border-[#B5E600] bg-white px-3 py-2 text-sm text-[#16231B] ${enfoqueClass}`}
      >
        {lista.map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function AvisosZona({ usuario }) {
  const a = useAvisosZona(usuario?.id)
  const { form, setCampo } = a
  const [cambiandoZona, setCambiandoZona] = useState(false)
  const [enApp, setEnApp] = useState(false)

  useEffect(() => {
    setEnApp(esApp())
  }, [])

  const buscando = cambiandoZona || !form.zona

  return (
    <div>
      <p className="mb-4 text-sm text-[#6B7355]">
        Elige una zona donde sueles entrenar y te avisaremos de las sesiones nuevas que encajen contigo. Solo
        avisamos de sesiones que empiecen en los próximos 7 días. Tu zona solo la usamos para avisarte: no se
        comparte con nadie y puedes desactivar los avisos cuando quieras.
      </p>

      {a.cargando ? (
        <p className="text-sm text-[#162318]/60">Cargando tu configuración...</p>
      ) : a.errorCarga ? (
        <div className="flex flex-col items-start gap-3">
          <p className="flex items-start gap-2 text-sm text-[#B85E60]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            No se pudo cargar tu configuración. Inténtalo de nuevo.
          </p>
          <button
            type="button"
            onClick={a.reintentarCarga}
            className={`corte-btn border-2 border-[#162318] px-5 py-2 text-sm font-semibold text-[#162318] transition hover:bg-[#162318] hover:text-white ${enfoqueClass}`}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Interruptor */}
          <div className="flex items-center justify-between gap-4">
            <span id="avisos-zona-activar" className="text-sm font-semibold text-[#162318]">
              Activar avisos en mi zona
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.activo}
              aria-labelledby="avisos-zona-activar"
              onClick={() => setCampo('activo', !form.activo)}
              className={
                (form.activo ? 'bg-[#B5E600]' : 'bg-zinc-300') +
                ` relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enfoqueClass}`
              }
            >
              <span
                className={
                  (form.activo ? 'translate-x-6' : 'translate-x-1') +
                  ' inline-block h-4 w-4 rounded-full bg-white transition'
                }
              />
            </button>
          </div>

          {form.activo && (
            <>
              {/* Zona habitual */}
              <div className="flex flex-col gap-2 border-t border-[#E2E6CF] pt-5">
                <h3 className={etiquetaClass}>Mi zona habitual</h3>
                {buscando ? (
                  <>
                    <BuscadorDireccion
                      placeholder="Busca tu localidad o dirección"
                      onSeleccionar={(sugerencia) => {
                        setCampo('zona', { nombre: sugerencia.nombre, lat: sugerencia.lat, lng: sugerencia.lng })
                        setCambiandoZona(false)
                      }}
                    />
                    <p className="text-xs text-[#6B7355]">
                      Buscamos en toda España. Elige una de las sugerencias para fijar la zona. No usamos tu GPS: la zona
                      solo cambia cuando tú la cambias.
                    </p>
                    {form.zona && (
                      <button
                        type="button"
                        onClick={() => setCambiandoZona(false)}
                        className={`self-start text-xs font-bold underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400] ${enfoqueClass}`}
                      >
                        Mantener la zona actual
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2">
                    <span className="flex min-w-0 items-start gap-2 text-sm font-semibold text-[#3D4A00]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                      <span className="break-words">{form.zona.nombre}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCambiandoZona(true)}
                      className={`shrink-0 text-xs font-bold underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400] ${enfoqueClass}`}
                    >
                      Cambiar zona
                    </button>
                  </div>
                )}
              </div>

              {/* Distancia */}
              <div className="flex flex-col gap-2">
                <h3 id="avisos-zona-distancia" className={etiquetaClass}>
                  Distancia máxima
                </h3>
                <div role="radiogroup" aria-labelledby="avisos-zona-distancia" className="grid grid-cols-4 gap-2">
                  {RADIOS_KM.map((km) => {
                    const elegido = form.radioKm === km
                    return (
                      <button
                        key={km}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setCampo('radioKm', km)}
                        className={
                          'corte-btn border-2 px-2 py-2 text-sm font-semibold transition ' +
                          enfoqueClass +
                          (elegido
                            ? ' border-[#B5E600] bg-[#B5E600] text-[#1F2400]'
                            : ' border-[#E2E6CF] bg-white text-[#162318] hover:border-[#B5E600]')
                        }
                      >
                        {km} km
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-[#6B7355]">Distancia en línea recta desde tu zona hasta la sesión.</p>
              </div>

              {/* Categorías */}
              <div className="flex flex-col gap-2">
                <h3 className={etiquetaClass}>Categorías</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map((categoria) => {
                    const elegida = form.categorias.includes(categoria)
                    return (
                      <button
                        key={categoria}
                        type="button"
                        aria-pressed={elegida}
                        onClick={() => a.alternarCategoria(categoria)}
                        className={
                          'inline-flex items-center gap-1.5 corte-btn border-2 px-3 py-2 text-sm font-semibold transition ' +
                          enfoqueClass +
                          (elegida
                            ? ' border-[#B5E600] bg-[#B5E600] text-[#1F2400]'
                            : ' border-[#E2E6CF] bg-white text-[#162318] hover:border-[#B5E600]')
                        }
                      >
                        {elegida && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
                        {categoria}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-[#6B7355]">Elige una o varias. Solo te avisaremos de las que marques.</p>
              </div>

              {/* Franja horaria */}
              <div className="flex flex-col gap-2">
                <h3 className={etiquetaClass}>Franja horaria de las sesiones</h3>
                <div className="flex gap-3">
                  <SelectorHora
                    id="avisos-zona-desde"
                    etiqueta="Desde"
                    valor={form.horaDesde}
                    opciones={HORAS_DESDE}
                    onChange={(v) => setCampo('horaDesde', v)}
                  />
                  <SelectorHora
                    id="avisos-zona-hasta"
                    etiqueta="Hasta"
                    valor={form.horaHasta}
                    opciones={HORAS_HASTA}
                    onChange={(v) => setCampo('horaHasta', v)}
                  />
                </div>
                <p className="text-xs text-[#6B7355]">
                  Es la hora a la que empieza la sesión, no la hora a la que recibes el aviso.
                </p>
              </div>

              {/* Modalidad */}
              <div className="flex flex-col gap-2">
                <h3 id="avisos-zona-modalidad" className={etiquetaClass}>
                  Cómo quieres recibir los avisos
                </h3>
                <div role="radiogroup" aria-labelledby="avisos-zona-modalidad" className="flex flex-col gap-2">
                  {MODOS.map((modo) => {
                    const elegido = form.modo === modo.clave
                    return (
                      <button
                        key={modo.clave}
                        type="button"
                        role="radio"
                        aria-checked={elegido}
                        onClick={() => setCampo('modo', modo.clave)}
                        className={
                          'flex items-start gap-3 corte-card border-2 px-4 py-3 text-left transition ' +
                          enfoqueClass +
                          (elegido ? ' border-[#B5E600] bg-[#F5F7E8]' : ' border-[#E2E6CF] bg-white hover:border-[#B5E600]')
                        }
                      >
                        <span
                          className={
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' +
                            (elegido ? 'border-[#3D4A00] bg-[#B5E600]' : 'border-zinc-300 bg-white')
                          }
                        >
                          {elegido && <span className="h-2 w-2 rounded-full bg-[#1F2400]" />}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-[#162318]">{modo.titulo}</span>
                          <span className="text-xs text-[#6B7355]">{modo.detalle}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="rounded-lg bg-[#3D4A00]/16 px-3 py-2 text-sm font-semibold text-[#3D4A00]">
                {enApp
                  ? 'Las notificaciones push de la app de iPhone llegarán más adelante. Mientras tanto verás los avisos en la campana de notificaciones.'
                  : 'Los avisos llegarán siempre a tu campana de notificaciones. Para recibirlos también como notificación en el móvil, activa las notificaciones en el interruptor que hay sobre el apartado «Notificaciones».'}
              </p>
            </>
          )}

          {/* Guardar */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={a.guardar}
                disabled={!a.hayCambios || a.guardando}
                className={`corte-btn bg-[#B5E600] px-6 py-2 font-semibold text-[#3D4A00] transition hover:brightness-95 disabled:opacity-50 ${enfoqueClass}`}
              >
                {a.guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              {!a.hayCambios && !a.mensaje && form.activo && (
                <span className="text-xs text-[#6B7355]">Sin cambios pendientes.</span>
              )}
            </div>
            <div aria-live="polite" role="status">
              {a.mensaje && (
                <p
                  className={
                    'flex items-start gap-2 text-sm ' + (a.mensaje.tipo === 'ok' ? 'text-[#3D4A00]' : 'text-[#B85E60]')
                  }
                >
                  {a.mensaje.tipo === 'ok' ? (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  )}
                  {a.mensaje.texto}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
