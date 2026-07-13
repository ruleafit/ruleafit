'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

export default function CuentaPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [username, setUsername] = useState(null)
  const [editando, setEditando] = useState(false)
  const [nuevoUsername, setNuevoUsername] = useState('')
  const [errorUsername, setErrorUsername] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user)

      if (data.user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('username')
          .eq('id', data.user.id)
          .single()

        setUsername(perfil?.username || null)
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

  if (cargando) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Mi cuenta
      </h1>

      {usuario ? (
        <div>
          <p style={{ marginBottom: 8 }}>
            Hola, <strong>{usuario.email}</strong>
          </p>
          <p style={{ marginBottom: 8 }}>
            Rol: <strong>{usuario.user_metadata?.rol || 'sin rol'}</strong>
          </p>

          {!editando && (
            <p style={{ marginBottom: 8 }}>
              Nombre de usuario: <strong>{username || 'sin nombre'}</strong>
            </p>
          )}

          {confirmacion && (
            <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 8 }}>{confirmacion}</p>
          )}

          {!editando && (
            <button
              type="button"
              onClick={empezarEdicion}
              style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, color: '#16a34a', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cambiar nombre de usuario
            </button>
          )}

          {editando && (
            <form onSubmit={guardarUsername} style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Nuevo nombre de usuario"
                value={nuevoUsername}
                onChange={(e) => {
                  setNuevoUsername(e.target.value)
                  if (errorUsername) setErrorUsername('')
                }}
                required
                style={{ display: 'block', width: '100%', padding: 10, marginBottom: errorUsername ? 4 : 12, border: '1px solid #ccc', borderRadius: 8 }}
              />
              {errorUsername && (
                <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{errorUsername}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{ flex: 1, padding: 10, background: '#B5E600', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.7 : 1 }}
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                  style={{ flex: 1, padding: 10, background: 'white', border: '1px solid #ccc', borderRadius: 8, fontWeight: 'bold', cursor: guardando ? 'default' : 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <button
            onClick={cerrarSesion}
            style={{ width: '100%', padding: 12, background: '#16231B', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : (
        <p>No has iniciado sesión. Ve a <a href="/login" style={{ color: '#16a34a', fontWeight: 'bold' }}>iniciar sesión</a>.</p>
      )}
    </div>
  )
}