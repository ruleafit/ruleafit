'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function RegistroPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function handleRegistro(e) {
    e.preventDefault()
    setMensaje('Creando cuenta...')

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      setMensaje('Error: ' + error.message)
    } else {
      setMensaje('¡Cuenta creada! Revisa tu email para confirmar.')
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Crear cuenta en Openfit
      </h1>

      <form onSubmit={handleRegistro}>
        <input
          type="email"
          placeholder="Tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <input
          type="password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <button
          type="submit"
          style={{ width: '100%', padding: 12, background: '#B5E600', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Crear cuenta
        </button>
      </form>

      {mensaje && <p style={{ marginTop: 16 }}>{mensaje}</p>}
    </div>
  )
}