'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

const CATEGORIAS = [
  'Fuerza / funcional',
  'Baile / coreografiado',
  'Yoga / movilidad',
  'Cardio / running',
  'Combate / boxeo',
  'Otra',
]

const CIUDADES = ['Sevilla', 'Málaga']

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

const inputStyle = { display: 'block', width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ccc', borderRadius: 8 }
const labelStyle = { fontWeight: 'bold', marginBottom: 4, display: 'block' }

export default function PublicarPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [modalidad, setModalidad] = useState('')
  const [ciudad, setCiudad] = useState(CIUDADES[0])
  const [direccion, setDireccion] = useState('')
  const [puntoEncuentro, setPuntoEncuentro] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState('')
  const [nivel, setNivel] = useState(NIVELES[0])
  const [precio, setPrecio] = useState('')
  const [plazasMax, setPlazasMax] = useState('')
  const [material, setMaterial] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
        return
      }
      setUsuario(data.user)
      setCargando(false)
    }
    comprobarSesion()
  }, [router])

  async function handlePublicar(e) {
    e.preventDefault()
    setMensaje('Publicando...')

    const { error } = await supabase.from('clases').insert({
      trainer_id: usuario.id,
      titulo,
      categoria,
      modalidad,
      ciudad,
      direccion,
      punto_encuentro: puntoEncuentro,
      fecha,
      hora,
      duracion: duracion === '' ? null : Number(duracion),
      nivel,
      precio: precio === '' ? null : Number(precio),
      plazas_max: plazasMax === '' ? null : Number(plazasMax),
      material,
      observaciones,
      estado: 'activa',
      plazas_ocupadas: 0,
      lat: null,
      lng: null,
    })

    if (error) {
      setMensaje('Error: ' + error.message)
    } else {
      setMensaje('¡Clase publicada correctamente!')
      setTitulo('')
      setModalidad('')
      setDireccion('')
      setPuntoEncuentro('')
      setFecha('')
      setHora('')
      setDuracion('')
      setPrecio('')
      setPlazasMax('')
      setMaterial('')
      setObservaciones('')
    }
  }

  if (cargando) {
    return <p style={{ textAlign: 'center', marginTop: 60 }}>Cargando...</p>
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Publicar una clase
      </h1>

      <form onSubmit={handlePublicar}>
        <label style={labelStyle}>Título</label>
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required style={inputStyle} />

        <label style={labelStyle}>Categoría</label>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label style={labelStyle}>Modalidad</label>
        <input
          type="text"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
          style={inputStyle}
          placeholder="Ej: presencial, online..."
        />

        <label style={labelStyle}>Ciudad</label>
        <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={inputStyle}>
          {CIUDADES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label style={labelStyle}>Dirección</label>
        <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Punto de encuentro</label>
        <input type="text" value={puntoEncuentro} onChange={(e) => setPuntoEncuentro(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Fecha</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={inputStyle} />

        <label style={labelStyle}>Hora</label>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required style={inputStyle} />

        <label style={labelStyle}>Duración (minutos)</label>
        <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} style={inputStyle} min="0" />

        <label style={labelStyle}>Nivel</label>
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={inputStyle}>
          {NIVELES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <label style={labelStyle}>Precio (€)</label>
        <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputStyle} min="0" step="0.01" />

        <label style={labelStyle}>Plazas máximas</label>
        <input type="number" value={plazasMax} onChange={(e) => setPlazasMax(e.target.value)} required style={inputStyle} min="1" />

        <label style={labelStyle}>Material necesario</label>
        <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          style={{ ...inputStyle, minHeight: 80 }}
        />

        <button
          type="submit"
          style={{ width: '100%', padding: 12, background: '#B5E600', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', marginTop: 8 }}
        >
          Publicar clase
        </button>
      </form>

      {mensaje && <p style={{ marginTop: 16 }}>{mensaje}</p>}
    </div>
  )
}
