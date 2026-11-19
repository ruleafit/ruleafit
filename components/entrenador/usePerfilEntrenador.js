'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { comprobarValoracion } from './comprobarValoracion'

function escaparParaIlike(texto) {
  return String(texto).replace(/[%_\\]/g, (caracter) => '\\' + caracter)
}

// Carga del perfil público de un rulero y de todo lo que cuelga de él.
export default function usePerfilEntrenador(username) {
  const [perfil, setPerfil] = useState(null)
  const [rulosSaldo, setRulosSaldo] = useState(0)
  const [clasesActivas, setClasesActivas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [promedioEstrellas, setPromedioEstrellas] = useState(null)
  const [totalValoraciones, setTotalValoraciones] = useState(0)
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [bonosOfrecidos, setBonosOfrecidos] = useState([])
  const [puedeValorar, setPuedeValorar] = useState(false)
  // Valoración que el usuario ya dejó a este rulero ({ id, estrellas, opinion }).
  const [valoracionPropia, setValoracionPropia] = useState(null)

  async function cargarValoraciones(entrenadorId) {
    const { data: valoracionesData } = await supabase
      .from('valoraciones')
      .select('estrellas')
      .eq('entrenador_id', entrenadorId)

    const lista = valoracionesData || []
    setTotalValoraciones(lista.length)
    setPromedioEstrellas(
      lista.length > 0 ? lista.reduce((suma, v) => suma + v.estrellas, 0) / lista.length : null
    )
  }

  useEffect(() => {
    async function cargarPerfil() {
      if (!username) return

      const { data: perfilData, error } = await supabase
        .from('perfiles')
        .select('id, username, descripcion, foto_url')
        .ilike('username', escaparParaIlike(username))
        .maybeSingle()

      if (error || !perfilData) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }

      setPerfil(perfilData)

      // Nivel público (pedido por el usuario el 12 sept 2026): el saldo de
      // Rulos de cualquiera ya es legible por cualquier autenticado desde
      // sql/061_niveles_publicos.sql, para poder mostrar el nivel de otros
      // ruleros y motivar a subir el propio.
      const { data: saldoFila } = await supabase
        .from('rulos_saldos')
        .select('saldo')
        .eq('usuario_id', perfilData.id)
        .maybeSingle()

      setRulosSaldo(saldoFila?.saldo ?? 0)

      const { data: clasesData } = await supabase
        .from('clases')
        .select('fecha, hora')
        .eq('trainer_id', perfilData.id)
        .eq('estado', 'activa')

      const activas = (clasesData || []).filter((clase) => !claseYaPaso(clase)).length
      setClasesActivas(activas)

      const { data: bonosData } = await supabase
        .from('bonos')
        .select('id, numero_sesiones, plazo_dias, precio, descripcion')
        .eq('trainer_id', perfilData.id)
        .eq('activo', true)
        .order('precio', { ascending: true })

      setBonosOfrecidos(bonosData || [])

      await cargarValoraciones(perfilData.id)

      const { data: userData } = await supabase.auth.getUser()
      setUsuarioActual(userData.user)

      // Quién puede valorar a este rulero: ver comprobarValoracion.js.
      if (userData.user && userData.user.id !== perfilData.id) {
        const resultado = await comprobarValoracion(userData.user.id, perfilData.id)
        setPuedeValorar(resultado.puedeValorar)
        if (resultado.valoracionPropia) setValoracionPropia(resultado.valoracionPropia)
      }

      setCargando(false)
    }
    cargarPerfil()
  }, [username])

  return {
    perfil,
    rulosSaldo,
    clasesActivas,
    cargando,
    noEncontrado,
    promedioEstrellas,
    totalValoraciones,
    usuarioActual,
    bonosOfrecidos,
    puedeValorar,
    valoracionPropia,
    recargarValoraciones: () => cargarValoraciones(perfil.id),
  }
}
