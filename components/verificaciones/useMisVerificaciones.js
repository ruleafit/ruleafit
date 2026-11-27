'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { rutaArchivo, VERSION_CONSENTIMIENTO, BUCKET_IDENTIDAD, BUCKET_TITULACIONES } from '../../lib/verificaciones/reglas'

async function subir(bucket, usuarioId, archivo) {
  const ruta = rutaArchivo(usuarioId, archivo.type, crypto.randomUUID())
  const { error } = await supabase.storage.from(bucket).upload(ruta, archivo, { contentType: archivo.type })
  if (error) throw new Error('No se pudo subir el archivo. Inténtalo de nuevo.')
  return ruta
}

async function llamar(funcion, parametros) {
  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'No se pudo guardar. Inténtalo de nuevo.')
  return data
}

async function avisar(tipo, id) {
  try {
    const { data } = await supabase.auth.getSession()
    await fetch('/api/verificaciones/aviso', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    })
  } catch {
    // La solicitud ya está guardada; el aviso es secundario.
  }
}

const limpiar = () => fetch('/api/verificaciones/limpiar', { method: 'POST' }).catch(() => {})

// Mis solicitudes de verificación (sql/110): carga, envío y retirada.
export default function useMisVerificaciones(usuarioId) {
  const [identidad, setIdentidad] = useState(null)
  const [titulaciones, setTitulaciones] = useState([])
  const [estado, setEstado] = useState('cargando') // cargando | ok | no-disponible

  const cargar = useCallback(async () => {
    const [i, t] = await Promise.all([
      supabase
        .from('verificaciones_identidad')
        .select('id, tipo_documento, estado, motivo, created_at')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('titulaciones')
        .select('id, nombre, entidad, anio, estado, motivo, created_at')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false }),
    ])
    if (i.error || t.error) return setEstado('no-disponible')
    setIdentidad(i.data[0] || null)
    setTitulaciones(t.data)
    setEstado('ok')
  }, [usuarioId])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function enviarIdentidad({ tipo, anverso, reverso }) {
    const rutaAnverso = await subir(BUCKET_IDENTIDAD, usuarioId, anverso)
    const rutaReverso = reverso ? await subir(BUCKET_IDENTIDAD, usuarioId, reverso) : null
    const id = await llamar('enviar_verificacion_identidad', {
      p_tipo: tipo,
      p_ruta_anverso: rutaAnverso,
      p_ruta_reverso: rutaReverso,
      p_consentimiento: VERSION_CONSENTIMIENTO,
    })
    avisar('identidad', id)
    await cargar()
  }

  async function enviarTitulacion({ nombre, entidad, anio, archivo }) {
    const ruta = await subir(BUCKET_TITULACIONES, usuarioId, archivo)
    const id = await llamar('enviar_titulacion', {
      p_nombre: nombre.trim(),
      p_entidad: entidad.trim(),
      p_anio: Number(anio),
      p_ruta: ruta,
      p_consentimiento: VERSION_CONSENTIMIENTO,
    })
    avisar('titulacion', id)
    await cargar()
  }

  async function retirarIdentidad() {
    await llamar('retirar_verificacion_identidad')
    limpiar()
    await cargar()
  }

  async function retirarTitulacion(id) {
    await llamar('retirar_titulacion', { p_id: id })
    limpiar()
    await cargar()
  }

  return { estado, identidad, titulaciones, enviarIdentidad, enviarTitulacion, retirarIdentidad, retirarTitulacion }
}
