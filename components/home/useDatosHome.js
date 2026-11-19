'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Sesión, nombre de usuario, sesiones publicadas propias y reservas propias
// que usa la portada.
export default function useDatosHome() {
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [username, setUsername] = useState(null)
  const [misClases, setMisClases] = useState(null)
  const [cargandoMisClases, setCargandoMisClases] = useState(true)
  const [misReservas, setMisReservas] = useState(null)
  const [cargandoMisReservas, setCargandoMisReservas] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
      setCargandoSesion(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    async function cargarUsername() {
      if (!usuario) {
        setUsername(null)
        return
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('username')
        .eq('id', usuario.id)
        .single()

      setUsername(perfil?.username || null)
    }
    cargarUsername()
  }, [usuario])

  useEffect(() => {
    async function cargarMisClases() {
      // Espera a que la sesión esté resuelta antes de decidir nada: si se
      // entra aquí con usuario todavía sin resolver (primer render), se
      // marcaría cargandoMisClases en false prematuramente y para siempre
      // (mismo fallo de condición de carrera que hubo en
      // app/mis-clases/[id]/editar/page.js).
      if (cargandoSesion) {
        return
      }

      // Se pide para cualquier usuario logueado, ya no solo "entrenador"
      // (Fase 3 de la unificación de roles, 11 sept 2026): mis_clases() ya
      // no exige rol desde la Fase 1, y ahora cualquiera puede tener
      // sesiones publicadas.
      if (!usuario) {
        setMisClases(null)
        setCargandoMisClases(false)
        return
      }

      const { data, error } = await supabase.rpc('mis_clases')

      if (error) {
        setMisClases(null)
      } else {
        setMisClases(data || [])
      }
      setCargandoMisClases(false)
    }
    cargarMisClases()
  }, [usuario, cargandoSesion])

  useEffect(() => {
    // Reservas propias como participante, para la franja de "Tus próximas
    // reservas" de la portada (pedido por el usuario el 11 sept 2026, junto
    // con dividir en dos la antigua franja de cifras del entrenador).
    async function cargarMisReservas() {
      if (cargandoSesion) {
        return
      }

      if (!usuario) {
        setMisReservas(null)
        setCargandoMisReservas(false)
        return
      }

      const { data, error } = await supabase
        .from('reservas')
        .select('id, estado, clases(id, titulo, fecha, hora)')
        .eq('cliente_id', usuario.id)
        .eq('estado', 'activa')
        .order('fecha', { foreignTable: 'clases', ascending: true })
        .order('hora', { foreignTable: 'clases', ascending: true })

      if (error) {
        setMisReservas(null)
      } else {
        setMisReservas(data || [])
      }
      setCargandoMisReservas(false)
    }
    cargarMisReservas()
  }, [usuario, cargandoSesion])

  return {
    usuario,
    cargandoSesion,
    username,
    misClases,
    cargandoMisClases,
    misReservas,
    cargandoMisReservas,
  }
}
