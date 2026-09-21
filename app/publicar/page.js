'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { CircleCheck, CircleAlert, Dumbbell, CalendarClock, MapPin, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

const MapaSelector = dynamic(() => import('../../components/MapaSelector'), {
  ssr: false,
  loading: () => <p className="text-sm text-[#6B7355]">Cargando mapa...</p>,
})

const CATEGORIAS = [
  'Fuerza / funcional',
  'Cardio',
  'Yoga / Pilates / movilidad',
  'Otros',
]

const CIUDADES = ['Sevilla', 'Málaga']

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const ayudaClass = 'mt-1 text-xs text-[#6B7355]'
const tarjetaClass = 'rounded-xl border border-[#E2E6CF] bg-white p-5 shadow-sm sm:p-6'
const botonPrimarioClass =
  'mt-2 w-full rounded-full bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

export default function PublicarPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [tipoActividad, setTipoActividad] = useState('')
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

  async function handlePublicar(e) {
    e.preventDefault()

    const { data } = await supabase.auth.getUser()
    const usuarioActual = data.user

    if (!usuarioActual) {
      setMensaje('Debes iniciar sesión para publicar.')
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

    if (claseYaPaso({ fecha, hora })) {
      setMensaje('La fecha y hora de la sesión ya han pasado. Elige un momento futuro.')
      return
    }

    setMensaje('Publicando...')

    const { error } = await supabase.from('clases').insert({
      trainer_id: usuarioActual.id,
      titulo,
      categoria,
      tipo_actividad: tipoActividad,
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
      setMensaje('¡Sesión publicada correctamente!')
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
      setTitulo('')
      setTipoActividad('')
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
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraPublicar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-sm text-[#6B7355] shadow-sm">
            Debes iniciar sesión para publicar. Ve a{' '}
            <a href="/login" className="font-semibold text-[#3D4A00] hover:underline">iniciar sesión</a>.
          </div>
        </div>
      </div>
    )
  }

  const esExito = mensaje === '¡Sesión publicada correctamente!'
  const esProgreso = mensaje === 'Publicando...'
  const esError = Boolean(mensaje) && !esExito && !esProgreso

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPublicar />

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <form onSubmit={handlePublicar} className="flex flex-col gap-6">
          <RevelarAlLlegar className={tarjetaClass}>
            <TituloBloque Icono={Dumbbell}>Qué vas a dar</TituloBloque>
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
                <label className={labelClass}>Tipo de actividad</label>
                <input
                  type="text"
                  value={tipoActividad}
                  onChange={(e) => setTipoActividad(e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Zumba, boxeo, running..."
                />
                <p className={ayudaClass}>Esto lo verán quienes reserven, tal cual lo escribas.</p>
              </div>

              <div>
                <label className={labelClass}>Nivel</label>
                <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClass}>
                  {NIVELES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </RevelarAlLlegar>

          <RevelarAlLlegar delayMs={80} className={tarjetaClass}>
            <TituloBloque Icono={CalendarClock}>Cuándo</TituloBloque>
            <div className="flex flex-col gap-4">
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
          </RevelarAlLlegar>

          <RevelarAlLlegar delayMs={160} className={tarjetaClass}>
            <TituloBloque Icono={MapPin}>Dónde</TituloBloque>
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
                <div className="w-full overflow-hidden rounded-xl border border-[#E2E6CF]">
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
                <label className={labelClass}>Zona</label>
                <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Nervión, o C/ Larios" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Punto de encuentro</label>
                <input type="text" value={puntoEncuentro} onChange={(e) => setPuntoEncuentro(e.target.value)} className={inputClass} />
                <p className={ayudaClass}>Sé concreto: ayuda a que nadie se pierda.</p>
              </div>
            </div>
          </RevelarAlLlegar>

          <RevelarAlLlegar delayMs={240} className={tarjetaClass}>
            <TituloBloque Icono={Tag}>Plazas y precio</TituloBloque>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Precio (€)</label>
                  <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className={inputClass} min="0" step="0.01" />
                  <p className="mt-1 text-sm font-semibold text-[#3D4A00]">Acuerda el precio con tus alumnos.</p>
                  <p className="text-xs text-[#6B7355]">A día de hoy, el 100% es para ti.</p>
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
                <p className={ayudaClass}>
                  Si no se llega a este mínimo, la sesión aparecerá como pendiente de confirmación. Déjalo vacío si no quieres mínimo.
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
          </RevelarAlLlegar>

          {/* Aviso pedido por el usuario el 12 sept 2026: recordar revisar
              los nombres de los inscritos antes de empezar la sesión.
              Mismo estilo que el aviso de cancelaciones en
              PreferenciasNotificaciones.js, pero en rojo para que
              destaque más. */}
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
            <span className="text-sm font-semibold text-red-700">
              Recuerda revisar los nombres antes de empezar la sesión en el apartado "Mis sesiones publicadas", para
              confirmar que todos los asistentes han reservado.
            </span>
          </div>

          <button type="submit" className={botonPrimarioClass}>
            Publicar sesión
          </button>
        </form>

        {mensaje && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              esExito
                ? 'border-[#B5E600]/50 bg-[#EDF5C9] text-[#3D4A00]'
                : esError
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-[#E2E6CF] bg-white text-[#6B7355]'
            }`}
          >
            {esExito && <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />}
            {esError && <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />}
            <p className="font-medium">{mensaje}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CabeceraPublicar() {
  return (
    <section className="relative isolate flex h-[180px] items-end overflow-hidden sm:h-[220px]">
      <img
        src="/imagenes/running.jpg"
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Publica tu sesión</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">Tú decides cuándo, dónde y con cuánta gente.</p>
      </div>
    </section>
  )
}

function TituloBloque({ Icono, children }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-l-4 border-[#B5E600] pl-3">
      <Icono className="h-6 w-6 shrink-0 text-[#3D4A00]" strokeWidth={1.75} />
      <h2 className="text-lg font-bold tracking-tight text-[#3D4A00] sm:text-xl">{children}</h2>
    </div>
  )
}
