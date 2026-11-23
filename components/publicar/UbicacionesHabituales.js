'use client'

import { useState } from 'react'
import { BookmarkPlus, Settings2, Pencil, Trash2, Check, X } from 'lucide-react'
import { direccionDePunto } from '../../lib/geocodificarInversa'
import { inputClass, labelClass, ayudaClass } from './constantes'

const msgOk = 'corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-2 text-sm font-medium text-[#3D4A00]'
const botonDiscreto =
  'inline-flex items-center gap-1.5 corte-tag border border-[#E2E6CF] bg-white px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] disabled:cursor-not-allowed disabled:opacity-50'

// «Mis ubicaciones habituales» (N09): selector arriba del bloque «Dónde» y enlace para gestionarlas.
// Elegir una rellena coordenadas, ciudad y provincia y centra el mapa; NO toca «Zona» ni «Punto de encuentro».
export function SelectorUbicaciones({ c, ub, onGestionar, panelAbierto }) {
  if (!ub.disponible || !ub.cargado || ub.lista.length === 0) return null
  const elegida = ub.lista.find((u) => u.id === c.ubicacionElegidaId)
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor="ubicacion-habitual" className={labelClass}>Mis ubicaciones habituales</label>
        <button type="button" onClick={onGestionar} aria-expanded={panelAbierto} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]">
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
          Gestionar ubicaciones
        </button>
      </div>
      <select
        id="ubicacion-habitual"
        value={c.ubicacionElegidaId}
        onChange={(e) => {
          const u = ub.lista.find((x) => x.id === e.target.value)
          if (u) c.elegirUbicacionHabitual(u)
          else c.quitarUbicacionHabitual()
        }}
        className={inputClass}
      >
        <option value="">Elegir una ubicación guardada…</option>
        {ub.lista.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre} — {u.ciudad}
          </option>
        ))}
      </select>
      {elegida ? (
        <div className="mt-2 text-xs text-[#6B7355]">
          <p>
            <span className="font-semibold text-[#3D4A00]">{elegida.nombre}</span> · {elegida.ciudad}
            {elegida.provincia && elegida.provincia !== elegida.ciudad ? ` (${elegida.provincia})` : ''}
            {elegida.direccion ? ` · ${elegida.direccion}` : ''}
          </p>
          <p className="mt-0.5">
            «Zona» y «Punto de encuentro» no se rellenan solos: indica en cada sesión el espacio concreto (por ejemplo, «Sala 2»).
          </p>
        </div>
      ) : (
        <p className={ayudaClass}>También puedes elegir el punto directamente en el mapa.</p>
      )}
    </div>
  )
}

// «Guardar esta ubicación»: opcional; solo pide un nombre privado.
export function GuardarUbicacion({ c, ub }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const listo = c.lat != null && c.lng != null && c.ciudad && c.ciudadTexto.trim() === c.ciudad
  if (!ub.disponible || !ub.cargado) return null
  if (!listo || c.ubicacionElegidaId) {
    return exito ? <p role="status" className={`mt-2 ${msgOk}`}>{exito}</p> : null
  }
  const cercana = ub.lista.find((u) => Math.abs(u.lat - c.lat) < 0.00005 && Math.abs(u.lng - c.lng) < 0.00005)

  async function guardar() {
    setError('')
    const n = nombre.trim()
    if (!n) return setError('Escribe un nombre para reconocer esta ubicación.')
    if (n.length > 60) return setError('El nombre puede tener como máximo 60 caracteres.')
    if (ub.lista.some((u) => u.nombre.trim().toLowerCase() === n.toLowerCase())) return setError('Ya tienes una ubicación guardada con ese nombre. Elige otro.')
    setGuardando(true)
    let direccion = ''
    try {
      direccion = await direccionDePunto(c.lat, c.lng)
    } catch {
      direccion = ''
    }
    const r = await ub.guardar({ nombre: n, ciudad: c.ciudad, provincia: c.provincia, direccion, lat: c.lat, lng: c.lng })
    setGuardando(false)
    if (!r.ok) return setError(r.mensaje)
    c.elegirUbicacionHabitual(r.ubicacion)
    setExito(`Ubicación «${r.ubicacion.nombre}» guardada. La tendrás disponible al publicar.`)
    setAbierto(false)
    setNombre('')
  }

  return (
    <div className="mt-2">
      {!abierto ? (
        <button type="button" onClick={() => { setAbierto(true); setExito('') }} className={botonDiscreto}>
          <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Guardar esta ubicación
        </button>
      ) : (
        <div className="corte-card border border-[#E2E6CF] bg-[#FBFAF3] p-3">
          <label htmlFor="nombre-ubicacion" className={labelClass}>Nombre para reconocerla (solo lo ves tú)</label>
          <input
            id="nombre-ubicacion"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            placeholder="Ej: Gimnasio Centro"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                guardar()
              }
            }}
            className={inputClass}
          />
          {cercana && <p className={ayudaClass}>Ya tienes «{cercana.nombre}» en este mismo punto; se guardará también con este nombre.</p>}
          {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 corte-btn bg-[#B5E600] px-4 py-1.5 text-xs font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60">
              <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setAbierto(false); setError('') }} className={botonDiscreto}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {exito && !abierto && <p role="status" className={`mt-2 ${msgOk}`}>{exito}</p>}
    </div>
  )
}

// Panel «Gestionar ubicaciones»: renombrar, mover desde el mapa y eliminar. Cambiarlas o borrarlas NO
// modifica ninguna sesión ya publicada (cada sesión guarda su propia copia de la ubicación).
export function PanelUbicaciones({ c, ub, editandoId, onEditarEnMapa, onCerrar }) {
  const [renombrando, setRenombrando] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [mensaje, setMensaje] = useState(null) // { tipo, texto }

  async function renombrar(u) {
    const n = nuevoNombre.trim()
    if (!n) return setMensaje({ tipo: 'error', texto: 'El nombre no puede estar vacío.' })
    if (ub.lista.some((x) => x.id !== u.id && x.nombre.trim().toLowerCase() === n.toLowerCase())) return setMensaje({ tipo: 'error', texto: 'Ya tienes una ubicación guardada con ese nombre.' })
    const r = await ub.actualizar(u.id, { nombre: n })
    if (!r.ok) return setMensaje({ tipo: 'error', texto: r.mensaje })
    setRenombrando('')
    setMensaje({ tipo: 'ok', texto: `Nombre actualizado: «${r.ubicacion.nombre}».` })
  }

  async function eliminar(u) {
    if (!window.confirm(`¿Eliminar la ubicación «${u.nombre}»? Las sesiones ya publicadas no cambian.`)) return
    const r = await ub.eliminar(u.id)
    if (!r.ok) return setMensaje({ tipo: 'error', texto: r.mensaje })
    if (c.ubicacionElegidaId === u.id) c.quitarUbicacionHabitual()
    setMensaje({ tipo: 'ok', texto: `Ubicación «${u.nombre}» eliminada. Las sesiones ya publicadas no cambian.` })
  }

  return (
    <div className="corte-card border border-[#B5E600] bg-[#FBFAF3] p-3" role="group" aria-label="Gestionar ubicaciones">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-[#1F2400]">Mis ubicaciones habituales</p>
        <button type="button" onClick={onCerrar} className="text-xs font-semibold text-[#6B7355] hover:underline">Cerrar</button>
      </div>
      <p className="mt-0.5 text-xs text-[#6B7355]">Solo las ves tú. Cambiarlas o eliminarlas no modifica las sesiones ya publicadas.</p>

      {mensaje && (
        <p role="status" className={`mt-2 ${mensaje.tipo === 'ok' ? msgOk : 'text-sm font-medium text-red-700'}`}>{mensaje.texto}</p>
      )}

      {ub.lista.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7355]">No tienes ubicaciones guardadas.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {ub.lista.map((u) => (
            <li key={u.id} className="corte-card border border-[#E2E6CF] bg-white p-3">
              {renombrando === u.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={60} aria-label="Nuevo nombre" className={`${inputClass} flex-1`} />
                  <button type="button" onClick={() => renombrar(u)} className="corte-btn bg-[#B5E600] px-3 py-1.5 text-xs font-bold text-[#1F2400]">Guardar</button>
                  <button type="button" onClick={() => setRenombrando('')} className={botonDiscreto}>Cancelar</button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#1F2400]">{u.nombre}</p>
                  <p className="text-xs text-[#6B7355]">
                    {u.ciudad}
                    {u.direccion ? ` · ${u.direccion}` : ''} · {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setRenombrando(u.id); setNuevoNombre(u.nombre); setMensaje(null) }} className={botonDiscreto}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Cambiar nombre
                    </button>
                    <button type="button" onClick={() => { onEditarEnMapa(u); setMensaje(null) }} disabled={editandoId === u.id} className={botonDiscreto}>
                      Editar en el mapa
                    </button>
                    <button type="button" onClick={() => eliminar(u)} className="inline-flex items-center gap-1.5 corte-tag px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Aviso mientras se mueve una ubicación guardada desde el mapa del formulario.
export function BannerEdicionUbicacion({ c, ub, ubicacion, onTerminar }) {
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const listo = c.lat != null && c.lng != null && c.ciudad && c.ciudadTexto.trim() === c.ciudad

  async function actualizar() {
    setMensaje('')
    setGuardando(true)
    let direccion = ubicacion.direccion || ''
    const cambio = Math.abs(ubicacion.lat - c.lat) > 0.00001 || Math.abs(ubicacion.lng - c.lng) > 0.00001
    if (cambio) {
      try {
        direccion = (await direccionDePunto(c.lat, c.lng)) || ''
      } catch {
        direccion = ''
      }
    }
    const r = await ub.actualizar(ubicacion.id, { ciudad: c.ciudad, provincia: c.provincia || null, direccion: direccion || null, lat: c.lat, lng: c.lng })
    setGuardando(false)
    if (!r.ok) return setMensaje(r.mensaje)
    onTerminar(`Ubicación «${r.ubicacion.nombre}» actualizada. Las sesiones ya publicadas no cambian.`)
  }

  return (
    <div className="mt-2 corte-card border border-[#B5E600] bg-[#EDF5C9] p-3 text-sm text-[#3D4A00]" role="status">
      <p className="font-semibold">Editando «{ubicacion.nombre}»</p>
      <p className="text-xs">Mueve el marcador o cambia la ciudad y pulsa «Actualizar ubicación». Las sesiones ya publicadas no cambian.</p>
      {mensaje && <p className="mt-1 font-medium text-red-700">{mensaje}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={actualizar} disabled={!listo || guardando} className="inline-flex items-center gap-1.5 corte-btn bg-[#B5E600] px-4 py-1.5 text-xs font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-50">
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
          {guardando ? 'Guardando…' : 'Actualizar ubicación'}
        </button>
        <button type="button" onClick={() => onTerminar('')} className={botonDiscreto}>
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Cancelar
        </button>
      </div>
    </div>
  )
}
