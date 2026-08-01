'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Coins, History } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import RevelarAlLlegar from '../../components/RevelarAlLlegar'

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
  const [openSaldo, setOpenSaldo] = useState(0)
  const [openMovimientos, setOpenMovimientos] = useState([])
  const [openMotivos, setOpenMotivos] = useState({})
  const [descripcionPerfil, setDescripcionPerfil] = useState('')
  const [fotoUrl, setFotoUrl] = useState(null)
  const [archivoFoto, setArchivoFoto] = useState(null)
  const [previewFoto, setPreviewFoto] = useState(null)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [confirmacionPerfil, setConfirmacionPerfil] = useState('')

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
          .from('open_saldos')
          .select('saldo')
          .eq('usuario_id', data.user.id)
          .maybeSingle()

        setOpenSaldo(saldoFila?.saldo ?? 0)

        const { data: movimientos } = await supabase
          .from('open_movimientos')
          .select('id, cantidad, motivo, nota, created_at')
          .eq('usuario_id', data.user.id)
          .order('created_at', { ascending: false })

        setOpenMovimientos(movimientos || [])

        const { data: motivos } = await supabase.from('open_motivos').select('codigo, descripcion')

        const mapaMotivos = {}
        for (const motivo of motivos || []) {
          mapaMotivos[motivo.codigo] = motivo.descripcion
        }
        setOpenMotivos(mapaMotivos)
      }
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  async function cerrarSesion() {
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

  const rol = usuario.user_metadata?.rol
  const rolMostrado = rol === 'entrenador' ? 'Entrenador' : rol === 'cliente' ? 'Cliente' : 'Sin rol'
  const inicial = (username || usuario.email || '?').charAt(0).toUpperCase()

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
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {rolMostrado}
          </span>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {rol === 'entrenador' ? (
          <div className="mb-8 rounded-xl border border-[#E2E6CF] bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-[#1F2400]">Perfil del entrenador</h2>

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
                  placeholder="Cuéntales a tus alumnos quién eres, tu experiencia y tu estilo de entrenamiento."
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
        ) : (
          <div className="mb-8 rounded-xl border border-[#E2E6CF] bg-white p-6">{bloqueUsername}</div>
        )}

        <RevelarAlLlegar className="mb-8 flex items-center gap-4 rounded-xl border border-[#E2E6CF] bg-[#EDF5C9] p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
            <Coins className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-3xl font-extrabold tracking-tight text-[#1F2400]">{openSaldo}</p>
            <p className="text-sm font-semibold text-[#3D4A00]">Open acumulados</p>
          </div>
        </RevelarAlLlegar>

        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#1F2400]">
            <History className="h-5 w-5 text-[#B5E600]" strokeWidth={1.75} />
            Historial de Open
          </h2>

          {openMovimientos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E6CF] px-6 py-8 text-center text-sm text-[#6B7355]">
              Todavía no tienes movimientos de Open. Cuando reserves o asistas a una clase, aparecerán aquí.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E6CF] overflow-hidden rounded-xl border border-[#E2E6CF] bg-white">
              {openMovimientos.map((mov) => (
                <div key={mov.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-[#1F2400]">{mov.nota || openMotivos[mov.motivo] || mov.motivo}</p>
                    <p className="text-xs text-[#6B7355]">{new Date(mov.created_at).toLocaleString('es-ES')}</p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${mov.cantidad > 0 ? 'text-[#3D4A00]' : 'text-red-700'}`}
                  >
                    {mov.cantidad > 0 ? '+' : ''}
                    {mov.cantidad} Open
                  </span>
                </div>
              ))}
            </div>
          )}
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
