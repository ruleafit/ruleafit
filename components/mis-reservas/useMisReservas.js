'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { plazoCancelacion } from '../../lib/plazoCancelacion'
import { tipoReserva } from './datos'
import useReprogramaciones from './useReprogramaciones'

// Sesión, carga de reservas propias y cancelación de una reserva.
export default function useMisReservas() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [reservas, setReservas] = useState([])
  const [canceladasAjenas, setCanceladasAjenas] = useState([])
  const [pagosSinPlaza, setPagosSinPlaza] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cancelandoId, setCancelandoId] = useState(null)
  const [erroresCancelacion, setErroresCancelacion] = useState({})
  // Cambios de fecha, hora o lugar pendientes de respuesta (sql/100).
  const reprogramaciones = useReprogramaciones(usuario, (reservaId, data) => {
    setReservas((prev) => prev.filter((r) => r.id !== reservaId))
    setMensaje(
      data?.usaba_bono
        ? 'Reserva cancelada sin coste. La sesión de tu bono vuelve a estar disponible.'
        : data?.reembolso === 'pendiente'
          ? 'Reserva cancelada sin coste. La devolución de tu pago queda pendiente de tramitar.'
          : 'Reserva cancelada sin coste.'
    )
    setTimeout(() => setMensaje(''), 8000)
  })

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
          'id, estado, cancelled_at, cancelada_por_entrenador, bono_cliente_id, clases(id, titulo, categoria, fecha, hora, duracion, ciudad, direccion, punto_encuentro, precio, plazas_max, plazas_min, plazas_ocupadas, trainer_id, perfiles(username))'
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
      // Pagos que no llegaron a dar plaza (sql/103). Si la función es la antigua o falla, no se muestra nada.
      const { data: reclamables } = await supabase.rpc('mis_reservas_reclamables')
      setPagosSinPlaza(Array.isArray(reclamables) ? reclamables.filter((x) => x.estado_reserva === 'sin_plaza') : [])
      setCargandoReservas(false)
    }
    cargarReservas()
  }, [usuario])

  async function handleCancelar(reserva, clase) {
    // Con menos de 2 h se puede cancelar igualmente, pero sin devolución (o con la sesión del bono
    // consumida): se avisa antes de confirmar.
    const tipo = tipoReserva(reserva, clase)
    const tardia = plazoCancelacion(clase).estado === 'cerrado'
    let pregunta = `¿Seguro que quieres cancelar tu reserva de ${clase.titulo}? Esta acción no se puede deshacer.`
    if (tardia) {
      const consecuencia =
        tipo === 'bono'
          ? ', pero la sesión de tu bono se considerará consumida'
          : tipo === 'pago'
            ? ', pero no recibirás la devolución del importe pagado'
            : ''
      pregunta = `¿Seguro que quieres cancelar? Tu plaza quedará libre para otra persona${consecuencia}.`
    }
    const confirmado = window.confirm(pregunta)
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
      !data?.cancelacion_tardia
        ? 'Reserva cancelada correctamente.'
        : data?.usaba_bono
          ? 'Reserva cancelada. Faltaban menos de 2 horas, así que la sesión de tu bono se considera consumida.'
          : data?.reembolso === 'sin_derecho'
            ? 'Reserva cancelada. Faltaban menos de 2 horas, así que no tienes derecho a devolución.'
            : 'Reserva cancelada correctamente. Tu plaza ha quedado libre para otra persona.'
    )
    setCancelandoId(null)
    setTimeout(() => setMensaje(''), 6000)
  }

  return {
    cargando: cargandoSesion || cargandoReservas,
    reservas,
    canceladasAjenas,
    pagosSinPlaza,
    error,
    mensaje,
    cancelandoId,
    erroresCancelacion,
    handleCancelar,
    reprogramaciones,
  }
}
