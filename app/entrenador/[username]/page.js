'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SearchX, Star } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { claseYaPaso } from '../../../lib/ventanaEdicionClase'
import BotonSeguir from '../../../components/BotonSeguir'

const botonPrimarioClass =
  'inline-flex h-10 items-center justify-center rounded-full bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100]'

const LIMITE_PALABRAS_OPINION = 100
const LIMITE_CARACTERES_OPINION = 750

function escaparParaIlike(texto) {
  return String(texto).replace(/[%_\\]/g, (caracter) => '\\' + caracter)
}

function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

export default function PerfilEntrenadorPage() {
  const { username } = useParams()
  const [perfil, setPerfil] = useState(null)
  const [clasesActivas, setClasesActivas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)

  const [promedioEstrellas, setPromedioEstrellas] = useState(null)
  const [totalValoraciones, setTotalValoraciones] = useState(0)

  const [usuarioActual, setUsuarioActual] = useState(null)
  const [puedeValorar, setPuedeValorar] = useState(false)
  const [valoracionId, setValoracionId] = useState(null)
  const [estrellasSeleccionadas, setEstrellasSeleccionadas] = useState(0)
  const [estrellasHover, setEstrellasHover] = useState(0)
  const [opinionTexto, setOpinionTexto] = useState('')
  const [guardandoValoracion, setGuardandoValoracion] = useState(false)
  const [errorValoracion, setErrorValoracion] = useState('')
  const [confirmacionValoracion, setConfirmacionValoracion] = useState('')

  async function cargarValoraciones(entrenadorId) {
    const { data: valoracionesData } = await supabase
      .from('valoraciones')
      .select('estrellas')
      .eq('entrenador_id', entrenadorId)

    const lista = valoracionesData || []
    setTotalValoraciones(lista.length)
    setPromedioEstrellas(
      lista.length > 0 ? lista.reduce((suma, v) => suma + v.estrellas, 0) / lista.length : null
    )
  }

  useEffect(() => {
    async function cargarPerfil() {
      if (!username) return

      const { data: perfilData, error } = await supabase
        .from('perfiles')
        .select('id, username, descripcion, foto_url')
        .ilike('username', escaparParaIlike(username))
        .maybeSingle()

      if (error || !perfilData) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }

      setPerfil(perfilData)

      const { data: clasesData } = await supabase
        .from('clases')
        .select('fecha, hora')
        .eq('trainer_id', perfilData.id)
        .eq('estado', 'activa')

      const activas = (clasesData || []).filter((clase) => !claseYaPaso(clase)).length
      setClasesActivas(activas)

      await cargarValoraciones(perfilData.id)

      const { data: userData } = await supabase.auth.getUser()
      setUsuarioActual(userData.user)

      if (userData.user && userData.user.user_metadata?.rol === 'cliente') {
        const { data: reservasActivas } = await supabase
          .from('reservas')
          .select('id, clases(trainer_id, fecha, hora)')
          .eq('cliente_id', userData.user.id)
          .eq('estado', 'activa')

        const haCompletadoClase = (reservasActivas || []).some(
          (reserva) => reserva.clases?.trainer_id === perfilData.id && claseYaPaso(reserva.clases)
        )

        setPuedeValorar(haCompletadoClase)

        if (haCompletadoClase) {
          const { data: valoracionPropia } = await supabase
            .from('valoraciones')
            .select('id, estrellas, opinion')
            .eq('cliente_id', userData.user.id)
            .eq('entrenador_id', perfilData.id)
            .maybeSingle()

          if (valoracionPropia) {
            setValoracionId(valoracionPropia.id)
            setEstrellasSeleccionadas(valoracionPropia.estrellas)
            setOpinionTexto(valoracionPropia.opinion || '')
          }
        }
      }

      setCargando(false)
    }
    cargarPerfil()
  }, [username])

  async function enviarValoracion(e) {
    e.preventDefault()
    setErrorValoracion('')
    setConfirmacionValoracion('')

    if (estrellasSeleccionadas < 1 || estrellasSeleccionadas > 5) {
      setErrorValoracion('Elige de 1 a 5 estrellas.')
      return
    }

    if (contarPalabras(opinionTexto) > LIMITE_PALABRAS_OPINION) {
      setErrorValoracion(`La opinión no puede superar ${LIMITE_PALABRAS_OPINION} palabras.`)
      return
    }

    setGuardandoValoracion(true)

    const editando = Boolean(valoracionId)

    const { data, error } = await supabase
      .from('valoraciones')
      .upsert(
        {
          cliente_id: usuarioActual.id,
          entrenador_id: perfil.id,
          estrellas: estrellasSeleccionadas,
          opinion: opinionTexto.trim() || null,
        },
        { onConflict: 'cliente_id,entrenador_id' }
      )
      .select('id, estrellas, opinion')
      .single()

    setGuardandoValoracion(false)

    if (error) {
      setErrorValoracion('Error: ' + error.message)
      return
    }

    setValoracionId(data.id)
    setConfirmacionValoracion(editando ? 'Valoración actualizada.' : '¡Gracias por tu valoración!')
    setTimeout(() => setConfirmacionValoracion(''), 5000)

    await cargarValoraciones(perfil.id)
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (noEncontrado) {
    return (
      <div className="flex min-h-[70vh] flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <SearchX className="h-12 w-12 text-[#B5E600]" strokeWidth={1.75} />
        <p className="text-sm text-[#6B7355]">Entrenador no encontrado.</p>
        <Link href="/clases" className={botonPrimarioClass}>
          Volver a sesiones
        </Link>
      </div>
    )
  }

  const inicial = (perfil.username || '?').charAt(0).toUpperCase()
  const palabrasOpinion = contarPalabras(opinionTexto)

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-center gap-3 bg-[#FBFAF3] px-4 pb-10 pt-14 text-center sm:pt-16">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#B5E600] text-3xl font-extrabold text-[#1F2400] shadow-sm">
          {perfil.foto_url ? (
            <img src={perfil.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            inicial
          )}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-[#1F2400] sm:text-3xl">
          @{perfil.username}
        </h1>

        <span className="inline-flex items-center rounded-full bg-[#EDF5C9] px-4 py-1.5 text-sm font-semibold text-[#3D4A00]">
          {clasesActivas} {clasesActivas === 1 ? 'sesión activa' : 'sesiones activas'}
        </span>

        <BotonSeguir entrenadorId={perfil.id} usuarioActual={usuarioActual} />
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">
            Sobre @{perfil.username}
          </h2>
          <p className="text-sm text-[#1F2400]">
            {perfil.descripcion || 'Este entrenador aún no ha completado su perfil.'}
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7355]">Valoraciones</h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Star className="h-5 w-5 text-[#B5E600]" fill="#B5E600" strokeWidth={1.5} />
              <span className="text-lg font-bold text-[#1F2400]">
                {promedioEstrellas !== null ? promedioEstrellas.toFixed(1).replace('.', ',') : '—'}
              </span>
            </div>
            <span className="text-sm text-[#6B7355]">
              {totalValoraciones === 0
                ? 'Sin valoraciones todavía'
                : totalValoraciones === 1
                  ? '(1 valoración)'
                  : `(${totalValoraciones} valoraciones)`}
            </span>
          </div>

          {totalValoraciones > 0 && (
            <Link
              href={`/entrenador/${perfil.username}/opiniones`}
              className="mt-3 inline-block text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
            >
              Ver opiniones
            </Link>
          )}

          {puedeValorar && (
            <form onSubmit={enviarValoracion} className="mt-6 border-t border-[#E2E6CF] pt-6">
              <p className="mb-2 text-sm font-semibold text-[#1F2400]">
                {valoracionId ? 'Edita tu valoración' : 'Valora a este entrenador'}
              </p>

              <div className="mb-4 flex gap-1">
                {[1, 2, 3, 4, 5].map((numero) => (
                  <button
                    key={numero}
                    type="button"
                    onClick={() => setEstrellasSeleccionadas(numero)}
                    onMouseEnter={() => setEstrellasHover(numero)}
                    onMouseLeave={() => setEstrellasHover(0)}
                    className="p-0.5"
                    aria-label={`${numero} estrella${numero === 1 ? '' : 's'}`}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        numero <= (estrellasHover || estrellasSeleccionadas)
                          ? 'text-[#B5E600]'
                          : 'text-[#E2E6CF]'
                      }`}
                      fill={numero <= (estrellasHover || estrellasSeleccionadas) ? 'currentColor' : 'none'}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={opinionTexto}
                onChange={(e) => {
                  setOpinionTexto(e.target.value.slice(0, LIMITE_CARACTERES_OPINION))
                  if (errorValoracion) setErrorValoracion('')
                }}
                maxLength={LIMITE_CARACTERES_OPINION}
                rows={3}
                placeholder="Cuenta tu experiencia (opcional)"
                className="block w-full rounded-xl border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
              />
              <p
                className={`mt-1 text-right text-xs ${
                  palabrasOpinion > LIMITE_PALABRAS_OPINION ? 'font-semibold text-red-600' : 'text-[#6B7355]'
                }`}
              >
                {palabrasOpinion}/{LIMITE_PALABRAS_OPINION} palabras
              </p>

              {errorValoracion && <p className="mb-3 text-xs text-red-600">{errorValoracion}</p>}
              {confirmacionValoracion && (
                <p className="mb-3 text-sm font-medium text-[#3D4A00]">{confirmacionValoracion}</p>
              )}

              <button
                type="submit"
                disabled={guardandoValoracion || estrellasSeleccionadas === 0}
                className="rounded-full bg-[#B5E600] px-6 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {guardandoValoracion
                  ? 'Guardando...'
                  : valoracionId
                    ? 'Actualizar valoración'
                    : 'Enviar valoración'}
              </button>
            </form>
          )}

          {usuarioActual && usuarioActual.user_metadata?.rol === 'cliente' && !puedeValorar && (
            <p className="mt-6 border-t border-[#E2E6CF] pt-6 text-sm text-[#6B7355]">
              Solo puedes valorar a un entrenador con el que hayas entrenado.
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/clases"
            className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
          >
            Ver todas las sesiones
          </Link>
        </div>
      </div>
    </div>
  )
}
