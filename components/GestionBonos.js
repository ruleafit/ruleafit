'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, Gift, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'

function formatearFecha(fechaIso) {
  if (!fechaIso) return ''
  return new Date(fechaIso).toLocaleDateString('es-ES')
}

function agruparPorBono(filas) {
  const mapa = new Map()

  for (const fila of filas) {
    let bono = mapa.get(fila.bono_id)
    if (!bono) {
      bono = {
        bono_id: fila.bono_id,
        descripcion: fila.bono_descripcion,
        precio: fila.bono_precio,
        numero_sesiones: fila.numero_sesiones,
        activo: fila.bono_activo,
        compradores: [],
      }
      mapa.set(fila.bono_id, bono)
    }
    if (fila.bono_cliente_id) {
      bono.compradores.push({
        bono_cliente_id: fila.bono_cliente_id,
        cliente_username: fila.cliente_username,
        sesiones_usadas: fila.sesiones_usadas,
        fecha_inicio: fila.fecha_inicio,
        fecha_fin: fila.fecha_fin,
      })
    }
  }

  return Array.from(mapa.values())
}

export default function GestionBonos({ usuario }) {
  const [bonos, setBonos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [modo, setModo] = useState('limitado') // 'limitado' | 'ilimitado'
  const [numeroSesiones, setNumeroSesiones] = useState('')
  const [plazoDias, setPlazoDias] = useState('')
  const [precio, setPrecio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState('')

  async function cargarBonos() {
    setCargando(true)
    const { data, error } = await supabase.rpc('compradores_de_mis_bonos')
    if (error) {
      setError(error.message)
      setCargando(false)
      return
    }
    setBonos(agruparPorBono(data || []))
    setError('')
    setCargando(false)
  }

  useEffect(() => {
    cargarBonos()
  }, [])

  async function handleCrearBono(e) {
    e.preventDefault()
    setErrorCrear('')

    const precioNumero = Number(precio)
    const plazoNumero = Number(plazoDias)
    const sesionesNumero = modo === 'ilimitado' ? null : Number(numeroSesiones)

    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setErrorCrear('Pon un precio válido.')
      return
    }
    if (!Number.isInteger(plazoNumero) || plazoNumero <= 0) {
      setErrorCrear('Pon un plazo en días válido (por ejemplo 30, o 180 para medio año).')
      return
    }
    if (modo === 'limitado' && (!Number.isInteger(sesionesNumero) || sesionesNumero <= 0)) {
      setErrorCrear('Pon un número de sesiones válido, o elige "Ilimitadas".')
      return
    }

    if (!usuario) {
      setErrorCrear('No se ha podido identificar tu sesión. Recarga la página e inténtalo de nuevo.')
      return
    }

    setCreando(true)

    const { error } = await supabase.from('bonos').insert({
      trainer_id: usuario.id,
      numero_sesiones: sesionesNumero,
      plazo_dias: plazoNumero,
      precio: precioNumero,
      descripcion: descripcion.trim() || null,
    })

    setCreando(false)

    if (error) {
      setErrorCrear(error.message)
      return
    }

    setNumeroSesiones('')
    setPlazoDias('')
    setPrecio('')
    setDescripcion('')
    setModo('limitado')
    setMostrarFormulario(false)
    await cargarBonos()
  }

  async function handleToggleActivo(bono) {
    const { error } = await supabase.from('bonos').update({ activo: !bono.activo }).eq('id', bono.bono_id)
    if (!error) await cargarBonos()
  }

  if (cargando) {
    return <p className="text-sm text-[#6B7355]">Cargando tus bonos...</p>
  }

  return (
    <div>
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-[#6B7355]">
          Crea bonos para que tus clientes los compren y los gasten en tus sesiones.
        </p>
        <button
          type="button"
          onClick={() => setMostrarFormulario((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Crear bono
        </button>
      </div>

      {mostrarFormulario && (
        <form
          onSubmit={handleCrearBono}
          className="mb-8 flex flex-col gap-4 rounded-xl border border-[#E2E6CF] bg-white p-5"
        >
          <div>
            <span className={labelClass}>Sesiones</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModo('limitado')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  modo === 'limitado'
                    ? 'border-[#B5E600] bg-[#EDF5C9] text-[#1F2400]'
                    : 'border-[#E2E6CF] text-[#6B7355]'
                }`}
              >
                Número fijo
              </button>
              <button
                type="button"
                onClick={() => setModo('ilimitado')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  modo === 'ilimitado'
                    ? 'border-[#B5E600] bg-[#EDF5C9] text-[#1F2400]'
                    : 'border-[#E2E6CF] text-[#6B7355]'
                }`}
              >
                Ilimitadas
              </button>
            </div>
          </div>

          {modo === 'limitado' && (
            <div>
              <label className={labelClass}>Número de sesiones</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Ej. 8"
                value={numeroSesiones}
                onChange={(e) => setNumeroSesiones(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Plazo para consumirlas (días)</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 30 (o 180 para medio año)"
              value={plazoDias}
              onChange={(e) => setPlazoDias(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[#6B7355]">
              Al terminar el plazo, las sesiones no consumidas se pierden. No hay opción de "sin caducidad".
            </p>
          </div>

          <div>
            <label className={labelClass}>Precio (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej. 80"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea
              rows={2}
              placeholder='Ej. "Pensado para 2 sesiones a la semana" o "Solo para clases de yoga"'
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[#6B7355]">
              La app no comprueba límites como "2 por semana" o el tipo de clase: si quieres repartirlo así,
              acláralo aquí y contrólalo tú mismo con tus clientes.
            </p>
          </div>

          {errorCrear && <p className="text-sm text-red-600">{errorCrear}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              className="rounded-full border border-[#E2E6CF] px-4 py-2 text-sm font-medium text-[#6B7355] hover:border-[#B5E600]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creando}
              className="rounded-full bg-[#B5E600] px-5 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {creando ? 'Creando...' : 'Crear bono'}
            </button>
          </div>
        </form>
      )}

      {bonos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#E2E6CF] px-6 py-10 text-center">
          <Gift className="h-8 w-8 text-[#B5E600]" strokeWidth={1.75} />
          <p className="text-sm text-[#6B7355]">Todavía no has creado ningún bono.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {bonos.map((bono) => (
            <div key={bono.bono_id} className="rounded-xl border border-[#E2E6CF] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#1F2400]">
                    {bono.numero_sesiones === null
                      ? 'Bono · sesiones ilimitadas'
                      : `Bono · ${bono.numero_sesiones} sesiones`}
                  </h3>
                  <p className="text-sm text-[#6B7355]">{bono.precio} €</p>
                  {bono.descripcion && <p className="mt-1 text-sm text-[#1F2400]">{bono.descripcion}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActivo(bono)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    bono.activo
                      ? 'border-[#B5E600] bg-[#EDF5C9] text-[#3D4A00] hover:bg-white'
                      : 'border-[#E2E6CF] text-[#6B7355] hover:border-red-200'
                  }`}
                >
                  {bono.activo ? 'Activo · desactivar' : 'Desactivado · reactivar'}
                </button>
              </div>

              <div className="mt-4 border-t border-[#E2E6CF] pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">
                  <Users className="h-3.5 w-3.5 text-[#B5E600]" strokeWidth={1.75} />
                  {bono.compradores.length === 0
                    ? 'Sin compradores todavía'
                    : `${bono.compradores.length} ${bono.compradores.length === 1 ? 'comprador' : 'compradores'}`}
                </div>

                {bono.compradores.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#E2E6CF] overflow-hidden rounded-lg border border-[#E2E6CF]">
                    {bono.compradores.map((c) => {
                      const caducado = new Date(c.fecha_fin) < new Date()
                      return (
                        <div
                          key={c.bono_cliente_id}
                          className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-sm font-semibold text-[#1F2400]">@{c.cliente_username}</p>
                          <p className={`text-xs ${caducado ? 'text-red-500' : 'text-[#6B7355]'}`}>
                            {bono.numero_sesiones === null
                              ? `${c.sesiones_usadas} sesiones usadas`
                              : `${c.sesiones_usadas} de ${bono.numero_sesiones} sesiones usadas`}
                            {' · '}
                            {caducado ? 'caducado el' : 'caduca el'} {formatearFecha(c.fecha_fin)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
