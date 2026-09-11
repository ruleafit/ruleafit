'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Coins, History, CalendarCheck, Star, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { calcularNivel } from '../../lib/niveles'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'
import NotificacionesToggle from '../../components/NotificacionesToggle'
import PreferenciasNotificaciones from '../../components/PreferenciasNotificaciones'
import HistorialNotificaciones from '../../components/HistorialNotificaciones'

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

export default function CuentaPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [username, setUsername] = useState(null)
  const [editando, setEditando] = useState(false)
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [errorUsername, setErrorUsername] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [rulosSaldo, setRulosSaldo] = useState(0)
  // Antes era un único contador que se calculaba de una forma u otra según
  // el rol guardado (participante o organizador, nunca los dos). Fase 7 de
  // la unificación de roles (11 sept 2026): se separan en dos contadores
  // que se calculan siempre, porque un mismo usuario puede tener ambos.
  const [sesionesParticipante, setSesionesParticipante] = useState(0)
  const [sesionesOrganizador, setSesionesOrganizador] = useState(0)
  const [numClasesOrganizadasTotal, setNumClasesOrganizadasTotal] = useState(0)
  const [promedioValoraciones, setPromedioValoraciones] = useState(null)
  const [totalValoraciones, setTotalValoraciones] = useState(0)
  const [numSeguidores, setNumSeguidores] = useState(0)
  const [rulosMovimientos, setRulosMovimientos] = useState([])
  const [rulosMotivos, setRulosMotivos] = useState({})
  const [descripcionPerfil, setDescripcionPerfil] = useState('')
  const [fotoUrl, setFotoUrl] = useState(null)
  const [archivoFoto, setArchivoFoto] = useState(null)
  const [previewFoto, setPreviewFoto] = useState(null)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [confirmacionPerfil, setConfirmacionPerfil] = useState('')
  const [pushActivadas, setPushActivadas] = useState(false)

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user)

      if (data.user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('username, descripcion, foto_url')
          .eq('id', data.user.id)
          .single()

        setUsername(perfil?.username || null)
        setDescripcionPerfil(perfil?.descripcion || '')
        setFotoUrl(perfil?.foto_url || null)

        const { data: saldoFila } = await supabase
          .from('rulos_saldos')
          .select('saldo')
          .eq('usuario_id', data.user.id)
          .maybeSingle()

        setRulosSaldo(saldoFila?.saldo ?? 0)

        const { data: movimientos } = await supabase
          .from('rulos_movimientos')
          .select('id, cantidad, motivo, nota, created_at')
          .eq('usuario_id', data.user.id)
          .order('created_at', { ascending: false })

        setRulosMovimientos(movimientos || [])

        const { data: motivos } = await supabase.from('rulos_motivos').select('codigo, descripcion')

        const mapaMotivos = {}
        for (const motivo of motivos || []) {
          mapaMotivos[motivo.codigo] = motivo.descripcion
        }
        setRulosMotivos(mapaMotivos)

        // Ya no depende del rol guardado (Fase 7 de la unificación de
        // roles, 11 sept 2026): cualquier usuario puede haber participado
        // en sesiones y/o haberlas organizado, así que estas consultas se
        // lanzan siempre en vez de excluirse según un rol fijo.
        const { data: reservasActivas } = await supabase
          .from('reservas')
          .select('id, clases(fecha, hora)')
          .eq('cliente_id', data.user.id)
          .eq('estado', 'activa')

        setSesionesParticipante(
          (reservasActivas || []).filter((r) => claseYaPaso(r.clases)).length
        )

        const { data: clasesOrganizadas } = await supabase
          .from('clases')
          .select('fecha, hora, estado')
          .eq('trainer_id', data.user.id)
          .neq('estado', 'cancelada')

        setNumClasesOrganizadasTotal((clasesOrganizadas || []).length)
        setSesionesOrganizador(
          (clasesOrganizadas || []).filter((c) => claseYaPaso({ fecha: c.fecha, hora: c.hora })).length
        )

        const { data: valoracionesPropias } = await supabase
          .from('valoraciones')
          .select('estrellas')
          .eq('entrenador_id', data.user.id)

        const listaValoraciones = valoracionesPropias || []
        setTotalValoraciones(listaValoraciones.length)
        setPromedioValoraciones(
          listaValoraciones.length > 0
            ? listaValoraciones.reduce((suma, v) => suma + v.estrellas, 0) / listaValoraciones.length
            : null
        )

        const { data: numSeg } = await supabase.rpc('contar_mis_seguidores')
        setNumSeguidores(numSeg ?? 0)
      }
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  async function cerrarSesion() {
    const confirmado = window.confirm('¿Estás seguro de que quieres cerrar sesión?')
    if (!confirmado) return

    await supabase.auth.signOut()
    setUsuario(null)
  }

  function empezarEdicion() {
    setNuevoUsername(username || '')
    setErrorUsername('')
    setConfirmacion('')
    setEditando(true)
  }

  function cancelarEdicion() {
    setEditando(false)
    setErrorUsername('')
  }

  async function guardarUsername(e) {
    e.preventDefault()

    if (!USERNAME_REGEX.test(nuevoUsername)) {
      setErrorUsername(
        'El nombre de usuario debe tener entre 3 y 20 caracteres, y solo puede contener letras (sin acentos ni ñ), números y guion bajo.'
      )
      return
    }

    setErrorUsername('')

    if (nuevoUsername.toLowerCase() !== (username || '').toLowerCase()) {
      setGuardando(true)
      const { data: disponible, error: errorDisponibilidad } = await supabase.rpc('username_disponible', {
        p_username: nuevoUsername,
      })

      if (errorDisponibilidad) {
        setGuardando(false)
        setErrorUsername('Error: ' + errorDisponibilidad.message)
        return
      }

      if (!disponible) {
        setGuardando(false)
        setErrorUsername('Ese nombre de usuario ya está en uso, prueba con otro.')
        return
      }
    }

    setGuardando(true)

    const { error } = await supabase
      .from('perfiles')
      .update({ username: nuevoUsername })
      .eq('id', usuario.id)

    setGuardando(false)

    if (error) {
      const detalle = error.message.toLowerCase()
      if (detalle.includes('username') || detalle.includes('perfiles') || detalle.includes('duplicate')) {
        setErrorUsername('Ese nombre de usuario ya está en uso. Prueba con otro.')
      } else {
        setErrorUsername('Error: ' + error.message)
      }
      return
    }

    setUsername(nuevoUsername)
    setEditando(false)
    setConfirmacion('Nombre de usuario actualizado correctamente.')
    setTimeout(() => setConfirmacion(''), 5000)
  }

  function comprimirImagen(archivo) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const urlOrigen = URL.createObjectURL(archivo)

      img.onload = () => {
        URL.revokeObjectURL(urlOrigen)

        const ladoMaximo = 800
        let { width, height } = img

        if (width > height && width > ladoMaximo) {
          height = Math.round((height * ladoMaximo) / width)
          width = ladoMaximo
        } else if (height > ladoMaximo) {
          width = Math.round((width * ladoMaximo) / height)
          height = ladoMaximo
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('No se pudo procesar la imagen.'))
          },
          'image/jpeg',
          0.8
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(urlOrigen)
        reject(new Error('No se pudo cargar la imagen.'))
      }

      img.src = urlOrigen
    })
  }

  function manejarSeleccionFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    if (previewFoto) URL.revokeObjectURL(previewFoto)

    setArchivoFoto(archivo)
    setPreviewFoto(URL.createObjectURL(archivo))
    setErrorPerfil('')
    setConfirmacionPerfil('')
  }

  async function guardarPerfil(e) {
    e.preventDefault()
    setErrorPerfil('')
    setConfirmacionPerfil('')

    if (contarPalabras(descripcionPerfil) > 300) {
      setErrorPerfil('La descripción no puede superar 300 palabras.')
      return
    }

    setGuardandoPerfil(true)

    let nuevaFotoUrl = fotoUrl

    if (archivoFoto) {
      try {
        const blobComprimido = await comprimirImagen(archivoFoto)
        const ruta = `${usuario.id}/avatar.jpg`

        const { error: errorSubida } = await supabase.storage
          .from('avatares')
          .upload(ruta, blobComprimido, { upsert: true, contentType: 'image/jpeg' })

        if (errorSubida) {
          setGuardandoPerfil(false)
          setErrorPerfil('Error al subir la foto: ' + errorSubida.message)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatares').getPublicUrl(ruta)

        nuevaFotoUrl = `${publicUrl}?v=${Date.now()}`
      } catch (err) {
        setGuardandoPerfil(false)
        setErrorPerfil('Error al procesar la imagen: ' + err.message)
        return
      }
    }

    const { error } = await supabase
      .from('perfiles')
      .update({ descripcion: descripcionPerfil, foto_url: nuevaFotoUrl })
      .eq('id', usuario.id)

    setGuardandoPerfil(false)

    if (error) {
      setErrorPerfil('Error: ' + error.message)
      return
    }

    if (previewFoto) URL.revokeObjectURL(previewFoto)

    setFotoUrl(nuevaFotoUrl)
    setArchivoFoto(null)
    setPreviewFoto(null)
    setConfirmacionPerfil('Perfil actualizado correctamente.')
    setTimeout(() => setConfirmacionPerfil(''), 5000)
  }

  useEffect(() => {
    if (cargando) return
    if (window.location.hash !== '#notificaciones') return

    let cancelado = false
    let intentos = 0
    function intentarScroll() {
      if (cancelado) return
      const el = document.getElementById('notificaciones')
      intentos += 1
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (intentos < 10) {
        requestAnimationFrame(intentarScroll)
      }
    }
    requestAnimationFrame(intentarScroll)

    return () => {
      cancelado = true
    }
  }, [cargando])

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[#6B7355]">Cargando...</p>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-[#6B7355]">
          No has iniciado sesión. Ve a{' '}
          <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">
            iniciar sesión
          </Link>
          .
        </p>
      </div>
    )
  }

  const inicial = (username || usuario.email || '?').charAt(0).toUpperCase()
  const infoNivel = calcularNivel(rulosSaldo)

  const bloqueUsername = (
    <>
      <p className="mb-1 text-sm text-[#6B7355]">
        Correo: <span className="text-[#1F2400]">{usuario.email}</span>
      </p>

      {!editando && (
        <p className="mb-3 text-sm text-[#6B7355]">
          Nombre de usuario: <span className="font-semibold text-[#1F2400]">{username || 'sin nombre'}</span>
        </p>
      )}

      {confirmacion && <p className="mb-3 text-sm font-medium text-[#3D4A00]">{confirmacion}</p>}

      {!editando && (
        <button
          type="button"
          onClick={empezarEdicion}
          className="text-sm font-semibold text-[#3D4A00] underline decoration-[#B5E600] decoration-2 underline-offset-2 hover:text-[#1F2400]"
        >
          Cambiar nombre de usuario
        </button>
      )}

      {editando && (
        <form onSubmit={guardarUsername} className="mt-2">
          <input
            type="text"
            placeholder="Nuevo nombre de usuario"
            value={nuevoUsername}
            onChange={(e) => {
              setNuevoUsername(e.target.value)
              if (errorUsername) setErrorUsername('')
            }}
            required
            className="mb-3 block w-full rounded-full border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
          />
          {errorUsername && <p className="mb-3 text-xs text-red-600">{errorUsername}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 rounded-full bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cancelarEdicion}
              disabled={guardando}
              className="flex-1 rounded-full border border-[#E2E6CF] px-4 py-2 text-sm font-bold text-[#1F2400] transition hover:border-[#B5E600] disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  )

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate flex h-[180px] items-center justify-center overflow-hidden sm:h-[220px]">
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <img src="/imagenes/fuerza.jpg" alt="" className="h-full w-full scale-110 object-cover blur-md" />
        </div>
        <div className="absolute inset-0 -z-10 bg-black/60" />

        <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-[#B5E600] text-2xl font-extrabold text-[#1F2400] shadow-sm sm:h-20 sm:w-20 sm:text-3xl">
            {fotoUrl ? (
              <img src={fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              inicial
            )}
          </div>
          <p className="text-lg font-bold text-white sm:text-xl">{username || usuario.email}</p>

          {/* Nivel de usuario (0-100), calculado a partir del saldo de
              Rulos. Ver lib/niveles.js para la curva de costes. */}
          <span className="inline-flex items-center rounded-full bg-[#B5E600] px-3 py-1 text-xs font-bold text-[#1F2400]">
            Nivel {infoNivel.nivel}
          </span>
          <div className="flex w-40 flex-col items-center gap-1 sm:w-48">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-[#B5E600]"
                style={{ width: `${Math.round(infoNivel.progreso * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-white/80">
              {infoNivel.esMaximo
                ? 'Nivel máximo alcanzado'
                : `${infoNivel.rulosParaSiguiente} rulos para el nivel ${infoNivel.nivel + 1}`}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {/* Antes este formulario de foto/descripción solo se mostraba con
            rol "entrenador". Fase 7 de la unificación de roles (11 sept
            2026): se abre a cualquier usuario, porque cualquiera puede
            publicar sesiones y tener un perfil público que otros visiten. */}
        <div className="mb-8 rounded-xl border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-[#1F2400]">Tu perfil</h2>

          <form onSubmit={guardarPerfil} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#E2E6CF] bg-[#FBFAF3]">
                {previewFoto || fotoUrl ? (
                  <img src={previewFoto || fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-[#B5E600]">
                    {inicial}
                  </div>
                )}
              </div>
              <label className="inline-block cursor-pointer rounded-full border border-[#E2E6CF] px-4 py-2 text-sm font-semibold text-[#3D4A00] transition hover:border-[#B5E600]">
                Elegir foto
                <input type="file" accept="image/*" onChange={manejarSeleccionFoto} className="hidden" />
              </label>
            </div>

            <div>
              <textarea
                value={descripcionPerfil}
                onChange={(e) => setDescripcionPerfil(e.target.value.slice(0, 3000))}
                maxLength={3000}
                rows={4}
                placeholder="Cuéntales a los demás quién eres, tu experiencia y, si organizas sesiones, tu estilo de entrenamiento."
                className="block w-full rounded-xl border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
              />
              <p
                className={`mt-1 text-right text-xs ${
                  contarPalabras(descripcionPerfil) > 300 ? 'font-semibold text-red-600' : 'text-[#6B7355]'
                }`}
              >
                {contarPalabras(descripcionPerfil)}/300 palabras
              </p>
            </div>

            {errorPerfil && <p className="text-xs text-red-600">{errorPerfil}</p>}
            {confirmacionPerfil && <p className="text-sm font-medium text-[#3D4A00]">{confirmacionPerfil}</p>}

            <button
              type="submit"
              disabled={guardandoPerfil}
              className="self-start rounded-full bg-[#B5E600] px-6 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </form>

          <div className="mt-6 border-t border-[#E2E6CF] pt-6">{bloqueUsername}</div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RevelarAlLlegar className="flex items-center gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              <Coins className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{rulosSaldo}</p>
              <p className="text-sm font-semibold text-[#3D4A00]">Rulos acumulados</p>
            </div>
          </RevelarAlLlegar>

          {/* Antes un único contador "Sesiones realizadas" que se calculaba
              de una forma u otra según el rol. Fase 7 de la unificación de
              roles (11 sept 2026): se muestran siempre los dos, porque un
              mismo usuario puede haber participado en unas y organizado
              otras. */}
          <RevelarAlLlegar className="flex items-center gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              <CalendarCheck className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{sesionesParticipante}</p>
              <p className="text-sm font-semibold text-[#3D4A00]">Sesiones en las que has participado</p>
            </div>
          </RevelarAlLlegar>

          <RevelarAlLlegar className="flex items-center gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              <CalendarCheck className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{sesionesOrganizador}</p>
              <p className="text-sm font-semibold text-[#3D4A00]">Sesiones que has organizado</p>
            </div>
          </RevelarAlLlegar>
        </div>

        {/* Valoraciones: antes solo visible con rol "entrenador". Fase 7 de
            la unificación de roles (11 sept 2026): siempre visible, con un
            mensaje distinto si el usuario nunca ha organizado ninguna
            sesión (no puede tener valoraciones todavía) frente a si ya
            organiza pero nadie le ha valorado aún. */}
        <RevelarAlLlegar className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              <Star className="h-7 w-7 text-[#B5E600]" fill="#B5E600" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">
                {promedioValoraciones !== null ? promedioValoraciones.toFixed(1).replace('.', ',') : '—'}
              </p>
              <p className="text-sm font-semibold text-[#3D4A00]">
                {totalValoraciones === 0
                  ? numClasesOrganizadasTotal === 0
                    ? 'Todavía no has organizado ninguna sesión'
                    : 'Sin valoraciones todavía'
                  : totalValoraciones === 1
                    ? '(1 valoración)'
                    : `(${totalValoraciones} valoraciones)`}
              </p>
            </div>
          </div>

          {totalValoraciones > 0 && username && (
            <Link
              href={`/entrenador/${username}/opiniones`}
              className="rounded-full border border-[#3D4A00] px-4 py-2 text-sm font-bold text-[#3D4A00] transition hover:bg-[#3D4A00] hover:text-white"
            >
              Ver opiniones
            </Link>
          )}
        </RevelarAlLlegar>

        <RevelarAlLlegar className="mb-8 flex items-center gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <Users className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{numSeguidores}</p>
            <p className="text-sm font-semibold text-[#3D4A00]">
              {numSeguidores === 1 ? 'usuario te sigue' : 'usuarios te siguen'}
            </p>
          </div>
        </RevelarAlLlegar>

        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2400]">
            <History className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
            Historial de Rulos
          </h2>

          {rulosMovimientos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E6CF] px-6 py-8 text-center text-sm text-[#6B7355]">
              Todavía no tienes movimientos de Rulos. Cuando reserves o asistas a una sesión, aparecerán aquí.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E6CF] overflow-hidden rounded-xl border border-[#E2E6CF] bg-white">
              {rulosMovimientos.map((mov) => (
                <div key={mov.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-[#1F2400]">{mov.nota || rulosMotivos[mov.motivo] || mov.motivo}</p>
                    <p className="text-xs text-[#6B7355]">{new Date(mov.created_at).toLocaleString('es-ES')}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${mov.cantidad > 0 ? 'text-[#3D4A00]' : 'text-red-700'}`}
                  >
                    {mov.cantidad > 0 ? '+' : ''}
                    {mov.cantidad} Rulos
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="notificaciones" className="mb-8 scroll-mt-24 rounded-xl border border-[#E2E6CF] bg-white p-6">
          <h2 className="mb-2 text-lg font-bold text-[#1F2400]">Notificaciones</h2>
          <p className="mb-4 text-sm text-[#6B7355]">
            Recibe avisos en tu móvil cuando los usuarios que sigues publiquen sesiones y sobre tus reservas.
          </p>
          <NotificacionesToggle usuarioActual={usuario} onCambioEstado={setPushActivadas} />
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[#162318] mb-3">Qué notificaciones quieres recibir</h3>
            <PreferenciasNotificaciones usuarioActual={usuario} pushActivadas={pushActivadas} />
          </div>
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[#162318] mb-3">Últimas notificaciones</h3>
            <HistorialNotificaciones usuarioActual={usuario} />
          </div>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#1F2400] px-6 py-3 text-sm font-bold text-white transition hover:bg-black sm:w-auto"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
