'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarClock,
  ClipboardList,
  Users,
  Clock,
  CircleCheck,
  CircleX,
  CircleAlert,
  Ban,
  Pencil,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { IMAGEN_POR_CATEGORIA, IMAGEN_POR_DEFECTO } from '../../lib/imagenesCategoria'
import { textoPlazas } from '../../lib/formatoPlazas'
import { estadoConfirmacionClase, textoFaltanParaConfirmar } from '../../lib/confirmacionClase'
import { motivoNoEditableClase } from '../../lib/ventanaEdicionClase'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

const ETIQUETAS_ASISTENCIA = {
  pendiente: 'Sin marcar',
  asistio: 'Asistió',
  no_asistio: 'No asistió',
}

const ICONOS_ASISTENCIA = {
  pendiente: Clock,
  asistio: CircleCheck,
  no_asistio: CircleX,
}

const CLASES_BADGE_ASISTENCIA = {
  pendiente: 'bg-[#F4F5EE] text-[#6B7355]',
  asistio: 'bg-[#EDF5C9] text-[#3D4A00]',
  no_asistio: 'bg-red-50 text-red-700',
}

const CLASES_FILA_ASISTENCIA = {
  pendiente: '',
  asistio: 'bg-[#EDF5C9]/40',
  no_asistio: 'bg-red-50/50',
}

function obtenerAhoraMadridComoTexto() {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const partes = formateador.formatToParts(new Date())
  const obtener = (tipo) => partes.find((p) => p.type === tipo)?.value
  return `${obtener('year')}-${obtener('month')}-${obtener('day')} ${obtener('hour')}:${obtener('minute')}`
}

function claseYaPaso(clase) {
  if (!clase.clase_fecha || !clase.clase_hora) return false
  const horaCorta = String(clase.clase_hora).slice(0, 5)
  const inicioClase = `${clase.clase_fecha} ${horaCorta}`
  return inicioClase < obtenerAhoraMadridComoTexto()
}

function agruparAlumnosPorClase(filas) {
  const alumnosPorClase = new Map()

  for (const fila of filas) {
    let alumnos = alumnosPorClase.get(fila.clase_id)
    if (!alumnos) {
      alumnos = []
      alumnosPorClase.set(fila.clase_id, alumnos)
    }
    alumnos.push({
      reserva_id: fila.reserva_id,
      cliente_username: fila.cliente_username,
      reservado_en: fila.reservado_en,
      asistencia: fila.asistencia,
    })
  }

  return alumnosPorClase
}

function combinarClasesConAlumnos(clasesFilas, alumnosPorClase) {
  return clasesFilas.map((fila) => ({
    clase_id: fila.clase_id,
    clase_titulo: fila.titulo,
    clase_fecha: fila.fecha,
    clase_hora: fila.hora,
    categoria: fila.categoria,
    plazas_max: fila.plazas_max,
    plazas_min: fila.plazas_min,
    plazas_ocupadas: fila.plazas_ocupadas,
    estado: fila.estado,
    alumnos: alumnosPorClase.get(fila.clase_id) || [],
  }))
}

function TituloBloque({ Icono, children }) {
  return (
    <div className="mb-5 flex items-center gap-3 border-l-4 border-[#B5E600] pl-3">
      <Icono className="h-6 w-6 shrink-0 text-[#3D4A00]" strokeWidth={1.75} />
      <h2 className="text-lg font-bold tracking-tight text-[#3D4A00] sm:text-xl">{children}</h2>
    </div>
  )
}

function CabeceraMisClases() {
  return (
    <section className="relative isolate flex h-[180px] items-end overflow-hidden sm:h-[220px]">
      <img src="/imagenes/yoga.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Mis clases</h1>
        <p className="mt-1 text-sm text-white/85 sm:text-base">Tus clases publicadas y quién viene a cada una.</p>
      </div>
    </section>
  )
}

export default function MisClasesPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [clasesConAlumnos, setClasesConAlumnos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [error, setError] = useState('')
  const [procesandoAsistenciaId, setProcesandoAsistenciaId] = useState(null)
  const [erroresAsistencia, setErroresAsistencia] = useState({})
  const [procesandoCancelacionId, setProcesandoCancelacionId] = useState(null)
  const [erroresCancelacion, setErroresCancelacion] = useState({})
  const [mensajesCancelacion, setMensajesCancelacion] = useState({})

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
    async function cargarClases() {
      if (!usuario || !esEntrenador) {
        setCargandoDatos(false)
        return
      }

      const [respuestaClases, respuestaAlumnos] = await Promise.all([
        supabase.rpc('mis_clases'),
        supabase.rpc('reservas_de_mis_clases'),
      ])

      if (respuestaClases.error) {
        setError(respuestaClases.error.message)
        setCargandoDatos(false)
        return
      }

      if (respuestaAlumnos.error) {
        setError(respuestaAlumnos.error.message)
        setCargandoDatos(false)
        return
      }

      const alumnosPorClase = agruparAlumnosPorClase(respuestaAlumnos.data || [])
      setClasesConAlumnos(combinarClasesConAlumnos(respuestaClases.data || [], alumnosPorClase))
      setCargandoDatos(false)
    }
    cargarClases()
  }, [usuario, esEntrenador])

  async function handleMarcarAsistencia(reservaId, asistio) {
    setProcesandoAsistenciaId(reservaId)
    setErroresAsistencia((prev) => {
      const siguiente = { ...prev }
      delete siguiente[reservaId]
      return siguiente
    })

    const { error } = await supabase.rpc('marcar_asistencia', {
      p_reserva_id: reservaId,
      p_asistio: asistio,
    })

    if (error) {
      setErroresAsistencia((prev) => ({ ...prev, [reservaId]: error.message }))
      setProcesandoAsistenciaId(null)
      return
    }

    setClasesConAlumnos((prev) =>
      prev.map((clase) => ({
        ...clase,
        alumnos: clase.alumnos.map((alumno) =>
          alumno.reserva_id === reservaId
            ? { ...alumno, asistencia: asistio ? 'asistio' : 'no_asistio' }
            : alumno
        ),
      }))
    )
    setProcesandoAsistenciaId(null)
  }

  async function handleCancelarClase(claseId) {
    const confirmado = window.confirm(
      '¿Seguro que quieres cancelar esta clase? Se cancelarán también todas las reservas activas de tus alumnos. Esta acción no se puede deshacer.'
    )
    if (!confirmado) return

    setProcesandoCancelacionId(claseId)
    setErroresCancelacion((prev) => {
      const siguiente = { ...prev }
      delete siguiente[claseId]
      return siguiente
    })

    const { data, error } = await supabase.rpc('cancelar_clase', { p_clase_id: claseId })

    if (error) {
      setErroresCancelacion((prev) => ({ ...prev, [claseId]: error.message }))
      setProcesandoCancelacionId(null)
      return
    }

    setClasesConAlumnos((prev) =>
      prev.map((clase) => (clase.clase_id === claseId ? { ...clase, estado: 'cancelada' } : clase))
    )
    setMensajesCancelacion((prev) => ({
      ...prev,
      [claseId]: `Clase cancelada. Se han cancelado ${data?.reservas_canceladas ?? 0} reservas.`,
    }))
    setProcesandoCancelacionId(null)
  }

  if (cargandoSesion) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!esEntrenador) {
    return (
      <div className="flex flex-1 flex-col">
        <CabeceraMisClases />
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

  if (cargandoDatos) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraMisClases />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!error && clasesConAlumnos.length === 0 && (
          <RevelarAlLlegar className="flex flex-col items-center gap-3 rounded-xl border border-[#E2E6CF] bg-white px-6 py-14 text-center">
            <ClipboardList className="h-10 w-10 text-[#B5E600]" strokeWidth={1.75} />
            <p className="text-sm text-[#6B7355]">Todavía no has publicado ninguna clase.</p>
            <Link
              href="/publicar"
              className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]"
            >
              Publicar una clase
            </Link>
          </RevelarAlLlegar>
        )}

        {!error && clasesConAlumnos.length > 0 && (
          <>
            <TituloBloque Icono={ClipboardList}>Tus clases</TituloBloque>

            <div className="flex flex-col gap-5">
              {clasesConAlumnos.map((clase, indice) => {
                const haPasado = claseYaPaso(clase)
                const imagenClase = IMAGEN_POR_CATEGORIA[clase.categoria] || IMAGEN_POR_DEFECTO
                const porcentajeOcupado =
                  clase.plazas_max > 0 ? Math.min((clase.plazas_ocupadas / clase.plazas_max) * 100, 100) : 0
                const { tieneMinimo, pendienteConfirmacion, faltanParaConfirmar } = estadoConfirmacionClase({
                  plazasMin: clase.plazas_min,
                  plazasOcupadas: clase.plazas_ocupadas,
                })
                const esEditable = !motivoNoEditableClase({
                  fecha: clase.clase_fecha,
                  hora: clase.clase_hora,
                  estado: clase.estado,
                })

                return (
                  <RevelarAlLlegar key={clase.clase_id} delayMs={Math.min(indice * 60, 240)}>
                    <div
                      className={`tarjeta-hover overflow-hidden rounded-xl border bg-white shadow-sm ${
                        clase.estado === 'cancelada' ? 'border-red-200' : 'border-[#E2E6CF]'
                      }`}
                    >
                      <div className="zoom-imagen relative h-40 w-full sm:h-44">
                        <img src={imagenClase} alt="" className="h-full w-full object-cover" />
                        {clase.estado === 'cancelada' && (
                          <span className="absolute left-3 top-3 rounded-full border border-red-300 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-700">
                            Clase cancelada
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        <h3 className="text-lg font-bold text-[#1F2400] sm:text-xl">{clase.clase_titulo}</h3>

                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[#3D4A00]">
                          <CalendarClock className="h-4 w-4" strokeWidth={2} />
                          {clase.clase_fecha} · {clase.clase_hora}
                        </p>

                        <div className="mt-3">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#6B7355]">
                            <Users className="h-3.5 w-3.5 text-[#B5E600]" strokeWidth={1.75} />
                            {textoPlazas({
                              esEntrenador: true,
                              plazasOcupadas: clase.plazas_ocupadas,
                              plazasMax: clase.plazas_max,
                            })}
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDF5C9]">
                            <div
                              className="h-full rounded-full bg-[#B5E600] motion-safe:transition-all motion-safe:duration-300"
                              style={{ width: `${porcentajeOcupado}%` }}
                            />
                          </div>
                        </div>

                        {tieneMinimo && (
                          <div className="mt-3">
                            {pendienteConfirmacion ? (
                              <div className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                                {textoFaltanParaConfirmar(faltanParaConfirmar)}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 rounded-full bg-[#EDF5C9] px-3 py-1.5 text-xs font-semibold text-[#3D4A00]">
                                <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                                Mínimo alcanzado
                              </div>
                            )}
                          </div>
                        )}

                        {mensajesCancelacion[clase.clase_id] && (
                          <p className="mt-3 text-xs text-[#6B7355]">{mensajesCancelacion[clase.clase_id]}</p>
                        )}

                        {clase.alumnos.length === 0 ? (
                          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#E2E6CF] px-4 py-3 text-sm text-[#6B7355]">
                            <Users className="h-4 w-4 shrink-0 text-[#B5E600]" strokeWidth={1.75} />
                            Todavía no se ha apuntado nadie. En cuanto alguien reserve, lo verás aquí.
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-col divide-y divide-[#E2E6CF] overflow-hidden rounded-lg border border-[#E2E6CF]">
                            {clase.alumnos.map((alumno) => {
                              const procesando = procesandoAsistenciaId === alumno.reserva_id
                              const IconoAsistencia = ICONOS_ASISTENCIA[alumno.asistencia]

                              return (
                                <div
                                  key={alumno.reserva_id}
                                  className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${CLASES_FILA_ASISTENCIA[alumno.asistencia]}`}
                                >
                                  <div className="text-sm">
                                    <p className="font-semibold text-[#1F2400]">{alumno.cliente_username}</p>
                                    <p className="text-xs text-[#6B7355]">
                                      Reservó el {new Date(alumno.reservado_en).toLocaleString('es-ES')}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {haPasado && (
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${CLASES_BADGE_ASISTENCIA[alumno.asistencia]}`}
                                      >
                                        <IconoAsistencia className="h-3.5 w-3.5" strokeWidth={2} />
                                        {ETIQUETAS_ASISTENCIA[alumno.asistencia]}
                                      </span>
                                    )}

                                    {clase.estado === 'activa' && haPasado && alumno.asistencia === 'pendiente' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleMarcarAsistencia(alumno.reserva_id, true)}
                                          disabled={procesando}
                                          className="rounded-full border border-[#B5E600] px-3 py-1 text-xs font-semibold text-[#3D4A00] transition-colors hover:bg-[#EDF5C9] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {procesando ? '...' : 'Asistió'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMarcarAsistencia(alumno.reserva_id, false)}
                                          disabled={procesando}
                                          className="rounded-full border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#6B7355] transition-colors hover:border-[#6B7355] hover:text-[#1F2400] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {procesando ? '...' : 'No asistió'}
                                        </button>
                                      </>
                                    )}

                                    {clase.estado === 'activa' && alumno.asistencia !== 'pendiente' && (
                                      <button
                                        type="button"
                                        onClick={() => handleMarcarAsistencia(alumno.reserva_id, alumno.asistencia !== 'asistio')}
                                        disabled={procesando}
                                        className="text-xs font-medium text-[#6B7355] underline transition-colors hover:text-[#1F2400] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {procesando ? 'Corrigiendo...' : 'Corregir'}
                                      </button>
                                    )}
                                  </div>

                                  {erroresAsistencia[alumno.reserva_id] && (
                                    <p className="text-xs text-red-600">{erroresAsistencia[alumno.reserva_id]}</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {esEditable && (
                          <div className="mt-4 flex justify-end">
                            <Link
                              href={`/mis-clases/${clase.clase_id}/editar`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] transition-colors hover:border-[#B5E600] hover:bg-[#EDF5C9]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Editar
                            </Link>
                          </div>
                        )}

                        {clase.estado === 'activa' && !haPasado && (
                          <div className="mt-3 flex flex-col items-end gap-1.5 border-t border-[#E2E6CF] pt-3">
                            <button
                              type="button"
                              onClick={() => handleCancelarClase(clase.clase_id)}
                              disabled={procesandoCancelacionId === clase.clase_id}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                              {procesandoCancelacionId === clase.clase_id ? 'Cancelando...' : 'Cancelar esta clase'}
                            </button>
                            {erroresCancelacion[clase.clase_id] && (
                              <p className="text-xs text-red-600">{erroresCancelacion[clase.clase_id]}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </RevelarAlLlegar>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
