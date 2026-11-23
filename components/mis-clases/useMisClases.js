'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { agruparAlumnosPorClase, combinarClasesConAlumnos } from './datos'

// Sesión, carga de sesiones publicadas con sus alumnos y cancelación de sesión.
export default function useMisClases() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [clasesConAlumnos, setClasesConAlumnos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [error, setError] = useState('')
  const [procesandoCancelacionId, setProcesandoCancelacionId] = useState(null)
  const [erroresCancelacion, setErroresCancelacion] = useState({})
  const [mensajesCancelacion, setMensajesCancelacion] = useState({})
  // Series de sesiones recurrentes (C07): id de serie → { id, titulo, patron }.
  const [series, setSeries] = useState({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getSession()
      const usuarioSesion = data.session?.user || null

      if (!usuarioSesion) {
        router.push('/login')
        return
      }

      setUsuario(usuarioSesion)
      setCargandoSesion(false)
    }
    comprobarSesion()
  }, [router])

  useEffect(() => {
    async function cargarClases() {
      if (!usuario) {
        setCargandoDatos(false)
        return
      }

      const [respuestaClases, respuestaAlumnos, respuestaSeries] = await Promise.all([
        supabase.rpc('mis_clases'),
        supabase.rpc('reservas_de_mis_clases'),
        cargarSeries(usuario.id),
      ])

      if (respuestaClases.error) {
        setError(respuestaClases.error.message)
        setCargandoDatos(false)
        return
      }

      if (respuestaAlumnos.error) {
        setError(respuestaAlumnos.error.message)
        setCargandoDatos(false)
        return
      }

      const alumnosPorClase = agruparAlumnosPorClase(respuestaAlumnos.data || [])
      const combinadas = combinarClasesConAlumnos(respuestaClases.data || [], alumnosPorClase).map((cl) => ({
        ...cl,
        serie_id: respuestaSeries.serieDeClase.get(cl.clase_id) || null,
      }))
      setClasesConAlumnos(combinadas)
      setSeries(respuestaSeries.series)
      setCargandoDatos(false)
    }
    cargarClases()
  }, [usuario, version])

  // Vuelve a cargar todo (tras editar, cancelar o cambiar el patrón de una serie).
  function recargar() {
    setVersion((v) => v + 1)
  }

  async function handleCancelarClase(claseId) {
    const confirmado = window.confirm(
      '¿Seguro que quieres cancelar esta sesión? Se cancelarán también todas las reservas activas de tus alumnos. Esta acción no se puede deshacer.'
    )
    if (!confirmado) return

    setProcesandoCancelacionId(claseId)
    setErroresCancelacion((prev) => {
      const siguiente = { ...prev }
      delete siguiente[claseId]
      return siguiente
    })

    const { data, error } = await supabase.rpc('cancelar_clase', { p_clase_id: claseId })

    if (error) {
      setErroresCancelacion((prev) => ({ ...prev, [claseId]: error.message }))
      setProcesandoCancelacionId(null)
      return
    }

    setClasesConAlumnos((prev) =>
      prev.map((clase) => (clase.clase_id === claseId ? { ...clase, estado: 'cancelada' } : clase))
    )
    setMensajesCancelacion((prev) => ({
      ...prev,
      [claseId]: (() => {
        const n = data?.reservas_canceladas ?? 0
        if (n === 0) return 'Sesión cancelada. No tenía reservas activas.'
        return `Sesión cancelada. ${n === 1 ? 'Se ha cancelado 1 reserva.' : `Se han cancelado ${n} reservas.`}`
      })(),
    }))
    setProcesandoCancelacionId(null)
  }

  return {
    usuario,
    cargandoSesion,
    cargandoDatos,
    error,
    clasesConAlumnos,
    procesandoCancelacionId,
    erroresCancelacion,
    mensajesCancelacion,
    handleCancelarClase,
    series,
    recargar,
  }
}

// Sesiones que pertenecen a una serie y datos de las series del organizador. La lectura va por
// páginas de 1000 filas (límite de la API) para no perder sesiones en series largas.
async function cargarSeries(usuarioId) {
  const serieDeClase = new Map()
  for (let desde = 0; desde < 20000; desde += 1000) {
    const { data } = await supabase
      .from('clases')
      .select('id, serie_id')
      .eq('trainer_id', usuarioId)
      .not('serie_id', 'is', null)
      .order('id')
      .range(desde, desde + 999)
    for (const f of data || []) serieDeClase.set(f.id, f.serie_id)
    if (!data || data.length < 1000) break
  }
  const series = {}
  if (serieDeClase.size > 0) {
    const { data } = await supabase.from('series_sesiones').select('id, titulo, patron').eq('trainer_id', usuarioId)
    for (const s of data || []) series[s.id] = s
  }
  return { serieDeClase, series }
}
