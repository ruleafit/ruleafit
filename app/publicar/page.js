'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabaseClient'

const MapaSelector = dynamic(() => import('../../components/MapaSelector'), {
  ssr: false,
  loading: () => <p>Cargando mapa...</p>,
})

const CATEGORIAS = [
  'Fuerza / funcional',
  'Baile / coreografiado',
  'Yoga / movilidad',
  'Cardio / running',
  'Combate / boxeo',
  'Otra',
]

const CIUDADES = ['Sevilla', 'Málaga']

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

const inputClass =
  'block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-zinc-700'
const seccionTituloClass = 'mb-4 border-b border-zinc-200 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500'

export default function PublicarPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [modalidad, setModalidad] = useState('')
  const [ciudad, setCiudad] = useState(CIUDADES[0])
  const [direccion, setDireccion] = useState('')
  const [puntoEncuentro, setPuntoEncuentro] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [nivel, setNivel] = useState(NIVELES[0])
  const [precio, setPrecio] = useState('')
  const [plazasMax, setPlazasMax] = useState('')
  const [plazasMin, setPlazasMin] = useState('0')
  const [material, setMaterial] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user || null)
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  const esEntrenador = usuario?.user_metadata?.rol === 'entrenador'

  async function handlePublicar(e) {
    e.preventDefault()

    const { data } = await supabase.auth.getUser()
    const usuarioActual = data.user

    if (!usuarioActual || usuarioActual.user_metadata?.rol !== 'entrenador') {
      setMensaje('Solo los entrenadores pueden publicar clases.')
      return
    }

    if (lat == null || lng == null) {
      setMensaje('Selecciona una ubicación en el mapa antes de publicar.')
      return
    }

    const plazasMaxNum = Number(plazasMax)
    const plazasMinNum = plazasMin === '' ? 0 : Number(plazasMin)

    if (!Number.isInteger(plazasMinNum) || plazasMinNum < 0 || plazasMinNum > plazasMaxNum) {
      setMensaje('Las plazas mínimas deben ser un número entero entre 0 y las plazas máximas.')
      return
    }

    setMensaje('Publicando...')

    const { error } = await supabase.from('clases').insert({
      trainer_id: usuarioActual.id,
      titulo,
      categoria,
      modalidad,
      ciudad,
      direccion,
      punto_encuentro: puntoEncuentro,
      fecha,
      hora,
      duracion: duracion === '' ? null : Number(duracion),
      nivel,
      precio: precio === '' ? null : Number(precio),
      plazas_max: plazasMax === '' ? null : plazasMaxNum,
      plazas_min: plazasMinNum,
      material,
      observaciones,
      estado: 'activa',
      plazas_ocupadas: 0,
      lat,
      lng,
    })

    if (error) {
      setMensaje('Error: ' + error.message)
    } else {
      setMensaje('¡Clase publicada correctamente!')
      setTitulo('')
      setModalidad('')
      setDireccion('')
      setPuntoEncuentro('')
      setFecha('')
      setHora('')
      setDuracion('')
      setPrecio('')
      setPlazasMax('')
      setPlazasMin('0')
      setMaterial('')
      setObservaciones('')
      setLat(null)
      setLng(null)
    }
  }

  if (cargando) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Publicar una clase</h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          Debes iniciar sesión para publicar clases. Ve a{' '}
          <a href="/login" className="font-semibold text-[#7a9900] hover:underline">iniciar sesión</a>.
        </div>
      </div>
    )
  }

  if (!esEntrenador) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Publicar una clase</h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
          Solo los entrenadores pueden publicar clases.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold text-black sm:text-3xl">Publicar una clase</h1>

      <form onSubmit={handlePublicar} className="flex flex-col gap-10">
        <section>
          <h2 className={seccionTituloClass}>Detalles de la clase</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Título</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Categoría</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputClass}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Modalidad</label>
              <input
                type="text"
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className={inputClass}
                placeholder="Ej: presencial, online..."
              />
            </div>

            <div>
              <label className={labelClass}>Nivel</label>
              <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClass}>
                {NIVELES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Duración (minutos)</label>
              <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} className={inputClass} min="0" />
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className={seccionTituloClass}>Ubicación</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Ciudad</label>
              <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass}>
                {CIUDADES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Ubicación en el mapa</label>
              <div className="w-full overflow-hidden rounded-lg border border-zinc-300">
                <MapaSelector
                  ciudad={ciudad}
                  lat={lat}
                  lng={lng}
                  onCambiarUbicacion={(nuevaLat, nuevaLng) => {
                    setLat(nuevaLat)
                    setLng(nuevaLng)
                  }}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Dirección</label>
              <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Punto de encuentro</label>
              <input type="text" value={puntoEncuentro} onChange={(e) => setPuntoEncuentro(e.target.value)} className={inputClass} />
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8">
          <h2 className={seccionTituloClass}>Precio y plazas</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Precio (€)</label>
                <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className={inputClass} min="0" step="0.01" />
              </div>
              <div>
                <label className={labelClass}>Plazas máximas</label>
                <input type="number" value={plazasMax} onChange={(e) => setPlazasMax(e.target.value)} required className={inputClass} min="1" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Plazas mínimas</label>
              <input
                type="number"
                value={plazasMin}
                onChange={(e) => setPlazasMin(e.target.value)}
                className={inputClass}
                min="0"
                step="1"
                placeholder="0 (sin mínimo)"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Opcional. Si la clase no llega a este número de plazas ocupadas, se mostrará como pendiente de confirmación.
              </p>
            </div>

            <div>
              <label className={labelClass}>Material necesario</label>
              <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className={`${inputClass} min-h-[100px]`}
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          className="mt-2 w-full rounded-full bg-[#B5E600] px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Publicar clase
        </button>
      </form>

      {mensaje && <p className="mt-4 text-sm text-zinc-700">{mensaje}</p>}
    </div>
  )
}
