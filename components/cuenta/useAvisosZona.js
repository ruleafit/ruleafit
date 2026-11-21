'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Configuración de «Avisos de sesiones en mi zona» (tabla public.avisos_zona,
// sql/079). Una fila por usuario, protegida por RLS: cada usuario solo lee y
// escribe la suya. Aquí solo se guarda la configuración: no se envía nada.

export const RADIOS_KM = [1, 5, 10, 20]
export const NOMBRE_ZONA_MAX = 200 // mismo límite que la restricción CHECK de la tabla

// Por defecto: desactivado, resumen diario, 5 km, sin categorías y todo el día.
export const FORMULARIO_INICIAL = {
  activo: false,
  modo: 'diario',
  zona: null, // { nombre, lat, lng } o null mientras no se elija una ubicación real
  radioKm: 5,
  categorias: [],
  horaDesde: '00:00',
  horaHasta: '23:59',
}

const COLUMNAS = 'activo, modo, zona_nombre, zona_lat, zona_lng, radio_km, categorias, hora_desde, hora_hasta'

// La base devuelve la hora como "16:00:00": en pantalla y al guardar se usa "16:00".
function hhmm(valor, porDefecto) {
  return typeof valor === 'string' && /^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : porDefecto
}

function desdeFila(fila) {
  if (!fila) return FORMULARIO_INICIAL
  const hayZona =
    fila.zona_nombre != null && Number.isFinite(fila.zona_lat) && Number.isFinite(fila.zona_lng)
  return {
    activo: !!fila.activo,
    modo: fila.modo === 'inmediato' ? 'inmediato' : 'diario',
    zona: hayZona ? { nombre: fila.zona_nombre, lat: fila.zona_lat, lng: fila.zona_lng } : null,
    radioKm: RADIOS_KM.includes(fila.radio_km) ? fila.radio_km : 5,
    categorias: Array.isArray(fila.categorias) ? fila.categorias : [],
    horaDesde: hhmm(fila.hora_desde, '00:00'),
    horaHasta: hhmm(fila.hora_hasta, '23:59'),
  }
}

// Solo columnas con permiso de escritura para el usuario (el servidor fija
// activo_desde, created_at y updated_at).
function aFila(usuarioId, f) {
  return {
    usuario_id: usuarioId,
    activo: f.activo,
    modo: f.modo,
    zona_nombre: f.zona ? f.zona.nombre.slice(0, NOMBRE_ZONA_MAX) : null,
    zona_lat: f.zona ? f.zona.lat : null,
    zona_lng: f.zona ? f.zona.lng : null,
    radio_km: f.radioKm,
    categorias: f.categorias,
    hora_desde: f.horaDesde,
    hora_hasta: f.horaHasta,
  }
}

// Comparable sin depender del orden en que se marcaron las categorías.
function huella(f) {
  return JSON.stringify({ ...f, categorias: [...f.categorias].sort() })
}

// Devuelve el texto del problema o null si se puede guardar.
export function validar(f) {
  if (f.zona) {
    const { lat, lng } = f.zona
    const valida =
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    if (!valida || !f.zona.nombre?.trim()) return 'La zona elegida no es válida. Búscala de nuevo.'
  }
  if (f.horaDesde >= f.horaHasta) return 'La hora de inicio debe ser anterior a la hora de fin.'
  if (f.activo) {
    if (!f.zona) return 'Elige tu zona habitual para activar los avisos.'
    if (f.categorias.length === 0) return 'Elige al menos una categoría para activar los avisos.'
  }
  return null
}

export default function useAvisosZona(usuarioId) {
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [form, setForm] = useState(FORMULARIO_INICIAL)
  const [guardado, setGuardado] = useState(FORMULARIO_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null) // { tipo: 'ok' | 'error', texto }
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!usuarioId) return undefined
    let vivo = true
    setCargando(true)
    setErrorCarga(false)

    async function cargar() {
      try {
        const { data, error } = await supabase
          .from('avisos_zona')
          .select(COLUMNAS)
          .eq('usuario_id', usuarioId)
          .maybeSingle()
        if (!vivo) return
        if (error) {
          setErrorCarga(true)
        } else {
          const inicial = desdeFila(data)
          setForm(inicial)
          setGuardado(inicial)
        }
      } catch {
        if (vivo) setErrorCarga(true)
      } finally {
        if (vivo) setCargando(false)
      }
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [usuarioId, recarga])

  const setCampo = useCallback((campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setMensaje(null)
  }, [])

  const alternarCategoria = useCallback((categoria) => {
    setForm((prev) => ({
      ...prev,
      categorias: prev.categorias.includes(categoria)
        ? prev.categorias.filter((c) => c !== categoria)
        : [...prev.categorias, categoria],
    }))
    setMensaje(null)
  }, [])

  async function guardar() {
    if (guardando || errorCarga) return
    const problema = validar(form)
    if (problema) {
      setMensaje({ tipo: 'error', texto: problema })
      return
    }

    setGuardando(true)
    setMensaje(null)
    try {
      const { error } = await supabase
        .from('avisos_zona')
        .upsert(aFila(usuarioId, form), { onConflict: 'usuario_id' })
      if (error) {
        setMensaje({ tipo: 'error', texto: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' })
      } else {
        setGuardado(form)
        setMensaje({ tipo: 'ok', texto: 'Cambios guardados.' })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  return {
    cargando,
    errorCarga,
    reintentarCarga: () => setRecarga((n) => n + 1),
    form,
    setCampo,
    alternarCategoria,
    hayCambios: huella(form) !== huella(guardado),
    guardando,
    mensaje,
    guardar,
  }
}
