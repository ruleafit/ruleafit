'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const COLUMNAS = 'id, nombre, ciudad, provincia, direccion, lat, lng'

// Mensajes claros para los errores habituales.
export function mensajeErrorUbicacion(error) {
  const m = String(error?.message || '')
  if (error?.code === '23505' || /unico|unique|duplicate/i.test(m)) return 'Ya tienes una ubicación guardada con ese nombre. Elige otro.'
  if (/máximo de 50/.test(m)) return 'Has alcanzado el máximo de 50 ubicaciones guardadas. Elimina alguna para guardar otra.'
  if (/check|nombre|ciudad|lat|lng/i.test(m) && /violat|constraint/i.test(m)) return 'Revisa el nombre (hasta 60 caracteres) y la ubicación elegida.'
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}

// Ubicaciones habituales del organizador (N09): privadas, protegidas por RLS (cada usuario solo ve y
// modifica las suyas). Si la tabla no estuviera disponible, `disponible` es false y la función se oculta sin
// afectar a la publicación.
export default function useUbicacionesHabituales() {
  const [lista, setLista] = useState([])
  const [cargado, setCargado] = useState(false)
  const [disponible, setDisponible] = useState(true)
  const usuarioId = useRef(null)

  const cargar = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) {
      setCargado(true)
      return
    }
    usuarioId.current = u.user.id
    const { data, error } = await supabase.from('ubicaciones_habituales').select(COLUMNAS).eq('usuario_id', u.user.id).order('nombre')
    if (error) setDisponible(false)
    else setLista(data || [])
    setCargado(true)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Devuelve { ok, ubicacion } o { ok: false, mensaje }.
  async function guardar({ nombre, ciudad, provincia, direccion, lat, lng }) {
    if (!usuarioId.current) return { ok: false, mensaje: 'Inicia sesión para guardar ubicaciones.' }
    const { data, error } = await supabase
      .from('ubicaciones_habituales')
      .insert({ usuario_id: usuarioId.current, nombre: nombre.trim(), ciudad, provincia: provincia || null, direccion: direccion || null, lat, lng })
      .select(COLUMNAS)
      .single()
    if (error) return { ok: false, mensaje: mensajeErrorUbicacion(error) }
    setLista((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    return { ok: true, ubicacion: data }
  }

  async function actualizar(id, cambios) {
    const { data, error } = await supabase.from('ubicaciones_habituales').update(cambios).eq('id', id).select(COLUMNAS).single()
    if (error) return { ok: false, mensaje: mensajeErrorUbicacion(error) }
    setLista((prev) => prev.map((u) => (u.id === id ? data : u)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    return { ok: true, ubicacion: data }
  }

  async function eliminar(id) {
    const { error } = await supabase.from('ubicaciones_habituales').delete().eq('id', id)
    if (error) return { ok: false, mensaje: mensajeErrorUbicacion(error) }
    setLista((prev) => prev.filter((u) => u.id !== id))
    return { ok: true }
  }

  return { lista, cargado, disponible, guardar, actualizar, eliminar }
}
