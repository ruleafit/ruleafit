'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CircleAlert, Dumbbell, Tag, Lock } from 'lucide-react'
import { supabase } from '../../../../lib/supabaseClient'
import { motivoNoEditableClase } from '../../../../lib/ventanaEdicionClase'

const CATEGORIAS = [
  'Fuerza / funcional',
  'Cardio',
  'Yoga / Pilates / movilidad',
  'Otros',
]

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

const inputClass =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const ayudaClass = 'mt-1 text-xs text-[#6B7355]'
const tarjetaClass = 'rounded-xl border border-[#E2E6CF] bg-white p-5 shadow-sm sm:p-6'
const soloLecturaClass = 'block w-full rounded-lg border border-[#E2E6CF] bg-[#F4F5EE] px-3 py-2 text-sm text-[#6B7355]'
const botonPrimarioClass =
  'mt-2 w-full rounded-full bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100'

function TituloBloque({ Icono, children }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-l-4 border-[#B5E600] pl-3">
      <Icono className="h-6 w-6 shrink-0 text-[#3D4A00]" strokeWidth={1.75} />
      <h2 className="text-lg font-bold tracking-tight text-[#3D4A00] sm:text-xl">{children}</h2>
    </div>
  )
}

function CabeceraEditar() {
  return (
    <section className="relative isolate flex h-[180px] items-end overflow-hidden sm:h-[220px]">
      <img
        src="/imagenes/running.jpg"
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Editar clase</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">
          Solo puedes cambiar lo que no afecta a quienes ya han reservado.
        </p>
      </div>
    </section>
  )
}

export default function EditarClasePage() {
  const { id } = useParams()
  const router = useRouter()

  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [cargandoClase, setCargandoClase] = useState(true)
  const [clase, setClase] = useState(null)
  const [motivoNoEditable, setMotivoNoEditable] = useState('')
  const [errorCarga, setErrorCarga] = useState('')

  const [titulo, setTitulo] = useState('')
  const [tipoActividad, setTipoActividad] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [nivel, setNivel] = useState(NIVELES[0])
  const [material, setMaterial] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [puntoEncuentro, setPuntoEncuentro] = useState('')
  const [plazasMin, setPlazasMin] = useState('1')
  const [plazasMax, setPlazasMax] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getSession()
      const usuarioSesion = data.session?.user || null

      if (!usuarioSesion) {
        router.push('/login')
        return
      }

      setUsuario(usuarioSesion)
      setCargandoSesion(false)
    }
    comprobarSesion()
  }, [router])

  const esEntrenador = usuario?.user_metadata?.rol === 'entrenador'

  useEffect(() => {
    async function cargarClase() {
      // Espera a que la comprobación de sesión termine antes de decidir
      // nada: si se entra aquí con usuario todavía sin resolver (primer
      // render), esEntrenador da "false" y la guarda de abajo pondría
      // cargandoClase en false prematuramente, dejándolo así para siempre
      // (nunca se vuelve a poner en true) mientras la carga real de la
      // clase sigue en marcha. Eso abría el hueco de tiempo en el que el
      // formulario podía llegar a pintarse con clase todavía a null.
      if (cargandoSesion) {
        return
      }

      if (!usuario || !esEntrenador || !id) {
        setCargandoClase(false)
        return
      }

      const { data: misClases, error } = await supabase.rpc('mis_clases')

      if (error) {
        setErrorCarga(error.message)
        setCargandoClase(false)
        return
      }

      const filaClase = (misClases || []).find((c) => c.clase_id === id)
      const motivo = motivoNoEditableClase(filaClase)

      if (motivo) {
        setMotivoNoEditable(motivo)
        setCargandoClase(false)
        return
      }

      const { data: filaCompleta, error: errorCompleta } = await supabase
        .from('clases')
        .select('*')
        .eq('id', id)
        .single()

      if (errorCompleta || !filaCompleta) {
        setErrorCarga(errorCompleta?.message || 'No se han podido cargar los datos de la clase.')
        setCargandoClase(false)
        return
      }

      setClase(filaCompleta)
      setTitulo(filaCompleta.titulo || '')
      setTipoActividad(filaCompleta.tipo_actividad || '')
      setCategoria(filaCompleta.categoria || CATEGORIAS[0])
      setNivel(filaCompleta.nivel || NIVELES[0])
      setMaterial(filaCompleta.material || '')
      setObservaciones(filaCompleta.observaciones || '')
      setPuntoEncuentro(filaCompleta.punto_encuentro || '')
      setPlazasMin(String(filaCompleta.plazas_min ?? 1))
      setPlazasMax(String(filaCompleta.plazas_max ?? ''))
      setCargandoClase(false)
    }
    cargarClase()
  }, [usuario, esEntrenador, id, cargandoSesion])

  const sinMinimoDefinido = clase?.plazas_min === 0

  async function handleGuardar(e) {
    e.preventDefault()

    const plazasMinNum = Number(plazasMin)
    const plazasMaxNum = Number(plazasMax)

    // El suelo de 1 solo aplica si la clase ya tenía un mínimo antes; si no
    // tenía (plazas_min = 0), el campo se muestra de solo lectura y su
    // valor no cambia, así que no hace falta validarlo aquí.
    if (!sinMinimoDefinido) {
      if (!Number.isInteger(plazasMinNum) || plazasMinNum < 1) {
        setMensaje('Las plazas mínimas no pueden ser menores que 1.')
        return
      }

      if (plazasMinNum > clase.plazas_min) {
        setMensaje('Las plazas mínimas solo se pueden reducir, no aumentar.')
        return
      }
    }

    if (!Number.isInteger(plazasMaxNum) || plazasMaxNum < 1) {
      setMensaje('Las plazas máximas deben ser un número entero de al menos 1.')
      return
    }

    if (plazasMaxNum < clase.plazas_max) {
      setMensaje('Las plazas máximas solo se pueden aumentar, no reducir.')
      return
    }

    if (plazasMinNum > plazasMaxNum) {
      setMensaje('Las plazas mínimas no pueden superar a las plazas máximas.')
      return
    }

    setGuardando(true)
    setMensaje('')

    const { error } = await supabase.rpc('editar_clase', {
      p_clase_id: id,
      p_titulo: titulo,
      p_tipo_actividad: tipoActividad,
      p_categoria: categoria,
      p_nivel: nivel,
      p_material: material,
      p_observaciones: observaciones,
      p_punto_encuentro: puntoEncuentro,
      p_plazas_min: plazasMinNum,
      p_plazas_max: plazasMaxNum,
    })

    if (error) {
      setMensaje(error.message)
      setGuardando(false)
      return
    }

    router.push('/mis-clases')
  }

  if (cargandoSesion || cargandoClase) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!esEntrenador) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraEditar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-xl border border-[#E2E6CF] bg-white p-6 text-sm text-[#6B7355] shadow-sm">
            Esta página es solo para entrenadores. Ve a{' '}
            <Link href="/clases" className="font-semibold text-[#3D4A00] hover:underline">
              ver las clases disponibles
            </Link>
            .
          </div>
        </div>
      </div>
    )
  }

  if (errorCarga) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraEditar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <p className="font-medium">{errorCarga}</p>
          </div>
        </div>
      </div>
    )
  }

  if (motivoNoEditable) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraEditar />
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-2 rounded-xl border border-[#E2E6CF] bg-white p-6 text-sm text-[#6B7355] shadow-sm">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" strokeWidth={1.75} />
            <p>{motivoNoEditable}</p>
          </div>
          <Link
            href="/mis-clases"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
          >
            Volver a Mis clases
          </Link>
        </div>
      </div>
    )
  }

  if (!clase) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraEditar />

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <form onSubmit={handleGuardar} className="flex flex-col gap-6">
          <div className={tarjetaClass}>
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
                <p className={ayudaClass}>Esto lo verá el cliente tal cual lo escribas.</p>
              </div>

              <div>
                <label className={labelClass}>Nivel</label>
                <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClass}>
                  {NIVELES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
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

              <div>
                <label className={labelClass}>Punto de encuentro</label>
                <input
                  type="text"
                  value={puntoEncuentro}
                  onChange={(e) => setPuntoEncuentro(e.target.value)}
                  className={inputClass}
                />
                <p className={ayudaClass}>Sé concreto: ayuda a que nadie se pierda.</p>
              </div>
            </div>
          </div>

          <div className={tarjetaClass}>
            <TituloBloque Icono={Tag}>Plazas</TituloBloque>
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Plazas mínimas</label>
                {sinMinimoDefinido ? (
                  <>
                    <p className={soloLecturaClass}>Sin mínimo definido</p>
                    <p className={ayudaClass}>Esta clase no tiene mínimo. No se puede añadir uno desde aquí.</p>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={plazasMin}
                      onChange={(e) => setPlazasMin(e.target.value)}
                      className={inputClass}
                      min="1"
                      step="1"
                    />
                    <p className={ayudaClass}>
                      Solo se puede bajar (mínimo actual: {clase.plazas_min}), nunca subir, y nunca por debajo de 1.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className={labelClass}>Plazas máximas</label>
                <input
                  type="number"
                  value={plazasMax}
                  onChange={(e) => setPlazasMax(e.target.value)}
                  className={inputClass}
                  min={clase.plazas_max}
                  step="1"
                />
                <p className={ayudaClass}>Solo se puede subir (máximo actual: {clase.plazas_max}), nunca bajar.</p>
              </div>
            </div>
          </div>

          <div className={tarjetaClass}>
            <TituloBloque Icono={Lock}>Esto no se puede cambiar</TituloBloque>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Fecha</label>
                <p className={soloLecturaClass}>{clase.fecha}</p>
              </div>
              <div>
                <label className={labelClass}>Hora</label>
                <p className={soloLecturaClass}>{clase.hora}</p>
              </div>
              <div>
                <label className={labelClass}>Duración</label>
                <p className={soloLecturaClass}>{clase.duracion != null ? `${clase.duracion} min` : '—'}</p>
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <p className={soloLecturaClass}>{clase.ciudad || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Zona</label>
                <p className={soloLecturaClass}>{clase.direccion || '—'}</p>
              </div>
              <div>
                <label className={labelClass}>Precio</label>
                <p className={soloLecturaClass}>{clase.precio != null ? `${clase.precio} €` : '—'}</p>
              </div>
            </div>
          </div>

          <button type="submit" disabled={guardando} className={botonPrimarioClass}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        {mensaje && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <p className="font-medium">{mensaje}</p>
          </div>
        )}
      </div>
    </div>
  )
}
