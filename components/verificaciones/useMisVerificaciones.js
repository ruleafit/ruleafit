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

async function enviarAlServidor(url, cuerpo) {
  const { data } = await supabase.auth.getSession()
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

// La solicitud ya está guardada; el aviso al administrador es secundario.
const avisar = (tipo, id) => enviarAlServidor('/api/verificaciones/aviso', { tipo, id }).catch(() => {})

// Comprobación automática. Si no puede completarse, queda para revisión manual.
async function comprobar(tipo, id, datos, manual) {
  if (!manual) {
    try {
      const respuesta = await enviarAlServidor('/api/verificaciones/analizar', { tipo, id, ...datos })
      if (respuesta.ok) return await respuesta.json()
    } catch {
      // Se avisa abajo para revisarla a mano.
    }
  }
  await avisar(tipo, id)
  return { resultado: 'pendiente' }
}

const limpiar = () => fetch('/api/verificaciones/limpiar', { method: 'POST' }).catch(() => {})

// Mis solicitudes de verificación (sql/110-112): carga, envío y retirada.
export default function useMisVerificaciones(usuarioId) {
  const [identidad, setIdentidad] = useState(null)
  const [centro, setCentro] = useState(null)
  const [titulaciones, setTitulaciones] = useState([])
  const [fiscal, setFiscal] = useState(null)
  const [estado, setEstado] = useState('cargando') // cargando | ok | no-disponible

  const cargar = useCallback(async () => {
    const ultima = (tabla, columnas) =>
      supabase.from(tabla).select(columnas).eq('usuario_id', usuarioId).order('created_at', { ascending: false })
    const [i, t, c, f] = await Promise.all([
      ultima('verificaciones_identidad', 'id, tipo_documento, estado, motivo, created_at').limit(1),
      ultima('titulaciones', 'id, nombre, entidad, anio, estado, motivo, created_at'),
      ultima('verificaciones_centro', 'id, razon_social, cif, estado, motivo, created_at').limit(1),
      supabase.from('perfiles_fiscales').select('tipo, nombre_fiscal, nif').eq('usuario_id', usuarioId).maybeSingle(),
    ])
    if (i.error || t.error || c.error) return setEstado('no-disponible')
    setIdentidad(i.data[0] || null)
    setTitulaciones(t.data)
    setCentro(c.data[0] || null)
    setFiscal(f.data || null)
    setEstado('ok')
  }, [usuarioId])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function enviarIdentidad({ tipo, anverso, reverso, nombre, numero, manual }) {
    const rutaAnverso = await subir(BUCKET_IDENTIDAD, usuarioId, anverso)
    const rutaReverso = reverso ? await subir(BUCKET_IDENTIDAD, usuarioId, reverso) : null
    const id = await llamar('enviar_verificacion_identidad', {
      p_tipo: tipo,
      p_ruta_anverso: rutaAnverso,
      p_ruta_reverso: rutaReverso,
      p_consentimiento: VERSION_CONSENTIMIENTO,
    })
    const resultado = await comprobar('identidad', id, { nombre, numero }, manual)
    await cargar()
    return resultado
  }

  async function enviarCentro({ razonSocial, cif, archivo, manual }) {
    const ruta = await subir(BUCKET_IDENTIDAD, usuarioId, archivo)
    const id = await llamar('enviar_verificacion_centro', {
      p_razon_social: razonSocial.trim(),
      p_cif: cif,
      p_ruta: ruta,
      p_consentimiento: VERSION_CONSENTIMIENTO,
    })
    const resultado = await comprobar('centro', id, {}, manual)
    await cargar()
    return resultado
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

  async function retirar(funcion, parametros) {
    await llamar(funcion, parametros)
    limpiar()
    await cargar()
  }

  return {
    estado,
    identidad,
    centro,
    titulaciones,
    fiscal,
    enviarIdentidad,
    enviarCentro,
    enviarTitulacion,
    retirarIdentidad: () => retirar('retirar_verificacion_identidad'),
    retirarCentro: () => retirar('retirar_verificacion_centro'),
    retirarTitulacion: (id) => retirar('retirar_titulacion', { p_id: id }),
  }
}
