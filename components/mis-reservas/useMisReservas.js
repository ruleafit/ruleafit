'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

// Sesión, carga de reservas propias y cancelación de una reserva.
export default function useMisReservas() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [reservas, setReservas] = useState([])
  const [canceladasAjenas, setCanceladasAjenas] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cancelandoId, setCancelandoId] = useState(null)
  const [erroresCancelacion, setErroresCancelacion] = useState({})

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
    async function cargarReservas() {
      if (!usuario) {
        setCargandoReservas(false)
        return
      }

      const { data, error } = await supabase
        .from('reservas')
        .select(
          'id, estado, cancelled_at, cancelada_por_entrenador, clases(id, titulo, categoria, fecha, hora, duracion, ciudad, direccion, punto_encuentro, precio, plazas_max, plazas_min, plazas_ocupadas, trainer_id, perfiles(username))'
        )
        .eq('cliente_id', usuario.id)
        .or('estado.eq.activa,and(estado.eq.cancelada,cancelada_por_entrenador.eq.true)')
        .order('fecha', { foreignTable: 'clases', ascending: true })
        .order('hora', { foreignTable: 'clases', ascending: true })

      if (error) {
        setError('No hemos podido cargar tus reservas. Recarga la página o inténtalo en unos minutos.')
      } else {
        setReservas(data || [])
      }
      // Reservas canceladas que no has cancelado tú, con el estado de su reembolso. Si la
      // función aún no existe o falla, simplemente no se muestran.
      const { data: ajenas } = await supabase.rpc('mis_reservas_canceladas_por_bloqueo')
      setCanceladasAjenas(Array.isArray(ajenas) ? ajenas : [])
      setCargandoReservas(false)
    }
    cargarReservas()
  }, [usuario])

  async function handleCancelar(reserva, clase) {
    const confirmado = window.confirm(
      `¿Seguro que quieres cancelar tu reserva de ${clase.titulo}? Esta acción no se puede deshacer.`
    )
    if (!confirmado) return

    setCancelandoId(reserva.id)
    setErroresCancelacion((prev) => {
      const siguiente = { ...prev }
      delete siguiente[reserva.id]
      return siguiente
    })

    const { data, error } = await supabase.rpc('cancelar_reserva', { p_reserva_id: reserva.id })

    if (error) {
      setErroresCancelacion((prev) => ({ ...prev, [reserva.id]: error.message }))
      setCancelandoId(null)
      return
    }

    setReservas((prev) => prev.filter((r) => r.id !== reserva.id))
    setMensaje(
      data?.reembolso_aplicable
        ? 'Reserva cancelada correctamente.'
        : 'Reserva cancelada. Como faltaban menos de 2 horas, no habría devolución si la sesión tuviera un pago asociado.'
    )
    setCancelandoId(null)
    setTimeout(() => setMensaje(''), 6000)
  }

  return {
    cargando: cargandoSesion || cargandoReservas,
    reservas,
    canceladasAjenas,
    error,
    mensaje,
    cancelandoId,
    erroresCancelacion,
    handleCancelar,
  }
}
