'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ClasesPage() {
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarClases() {
      const { data, error } = await supabase
        .from('clases')
        .select('*')
        .eq('estado', 'activa')
        .order('fecha', { ascending: true })

      if (error) {
        setError('Error al cargar las clases: ' + error.message)
      } else {
        setClases(data || [])
      }
      setCargando(false)
    }
    cargarClases()
  }, [])

  if (cargando) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Clases disponibles
      </h1>

      {error && <p style={{ color: 'crimson', marginBottom: 16 }}>{error}</p>}

      {!error && clases.length === 0 && <p>No hay clases disponibles por ahora.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {clases.map((clase) => (
          <div key={clase.id} style={{ border: '1px solid #ccc', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 'bold', color: '#7a9900', marginBottom: 4, textTransform: 'uppercase' }}>
              {clase.modalidad}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>{clase.titulo}</h2>
            <p style={{ marginBottom: 4 }}>
              Ciudad: <strong>{clase.ciudad}</strong>
            </p>
            <p style={{ marginBottom: 4 }}>
              Fecha: <strong>{clase.fecha}</strong> — Hora: <strong>{clase.hora}</strong>
            </p>
            <p style={{ marginBottom: 4 }}>
              Precio: <strong>{clase.precio} €</strong>
            </p>
            <p>
              Plazas: <strong>{clase.plazas_ocupadas}/{clase.plazas_max}</strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
