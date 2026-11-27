'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import useReprogramaciones from './useReprogramaciones'
import { DEVOLUCION_EN_MARCHA, mensajeCancelacion } from '../../lib/pagos/textoDevolucion.ts'

// Sesión, carga de reservas propias y cancelación de una reserva.
export default function useMisReservas() {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [reservas, setReservas] = useState([])
  const [canceladasAjenas, setCanceladasAjenas] = useState([])
  const [pagosSinPlaza, setPagosSinPlaza] = useState([])
  const [cobrosPorReserva, setCobrosPorReserva] = useState({}) // reserva_id -> estado de su cobro
  const [cargandoReservas, setCargandoReservas] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  // Cambios de fecha, hora o lugar pendientes de respuesta (sql/100).
  const reprogramaciones = useReprogramaciones(usuario, (reservaId, data) => {
    setReservas((prev) => prev.filter((r) => r.id !== reservaId))
    setMensaje(
      data?.usaba_bono
        ? 'Reserva cancelada sin coste. La sesión de tu bono vuelve a estar disponible.'
        : data?.reembolso === 'pendiente'
          ? `Reserva cancelada sin coste. ${DEVOLUCION_EN_MARCHA}`
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
      // Estado de los cobros propios (RLS), para explicar la devolución en las reservas canceladas.
      const { data: cobros } = await supabase
        .from('cobros')
        .select('reserva_id, estado')
        .eq('cliente_id', usuario.id)
        .in('estado', ['requiere_reembolso', 'reembolsado'])
      setCobrosPorReserva(Object.fromEntries((cobros || []).filter((x) => x.reserva_id).map((x) => [x.reserva_id, x.estado])))
      setCargandoReservas(false)
    }
    cargarReservas()
  }, [usuario])

  // La cancelación la hace components/reserva/CancelarReserva; aquí solo se actualiza la lista.
  function alCancelar(reservaId, data) {
    setReservas((prev) => prev.filter((r) => r.id !== reservaId))
    setMensaje(mensajeCancelacion(data))
    setTimeout(() => setMensaje(''), 10000)
  }

  return {
    cargando: cargandoSesion || cargandoReservas,
    reservas,
    canceladasAjenas,
    pagosSinPlaza,
    cobrosPorReserva,
    error,
    mensaje,
    alCancelar,
    reprogramaciones,
  }
}
