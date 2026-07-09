'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function CuentaPage() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user)
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUsuario(null)
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
          <p style={{ marginBottom: 16 }}>
            Hola, <strong>{usuario.email}</strong>
          </p>
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