'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'

// Carga de todos los datos de la página /cuenta (mismas consultas y mismo
// orden que tenía app/cuenta/page.js antes de dividirse).
export default function useDatosCuenta() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [username, setUsername] = useState(null)
  const [rulosSaldo, setRulosSaldo] = useState(0)
  // Antes era un único contador que se calculaba de una forma u otra según
  // el rol guardado (participante o organizador, nunca los dos). Fase 7 de
  // la unificación de roles (11 sept 2026): se separan en dos contadores
  // que se calculan siempre, porque un mismo usuario puede tener ambos.
  const [sesionesParticipante, setSesionesParticipante] = useState(0)
  const [sesionesOrganizador, setSesionesOrganizador] = useState(0)
  const [numClasesOrganizadasTotal, setNumClasesOrganizadasTotal] = useState(0)
  const [promedioValoraciones, setPromedioValoraciones] = useState(null)
  const [totalValoraciones, setTotalValoraciones] = useState(0)
  const [numSeguidores, setNumSeguidores] = useState(0)
  const [rulosMovimientos, setRulosMovimientos] = useState([])
  const [rulosMotivos, setRulosMotivos] = useState({})
  const [descripcionPerfil, setDescripcionPerfil] = useState('')
  const [fotoUrl, setFotoUrl] = useState(null)

  useEffect(() => {
    async function comprobarSesion() {
      const { data } = await supabase.auth.getUser()
      setUsuario(data.user)

      if (data.user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('username, descripcion, foto_url')
          .eq('id', data.user.id)
          .single()

        setUsername(perfil?.username || null)
        setDescripcionPerfil(perfil?.descripcion || '')
        setFotoUrl(perfil?.foto_url || null)

        const { data: saldoFila } = await supabase
          .from('rulos_saldos')
          .select('saldo')
          .eq('usuario_id', data.user.id)
          .maybeSingle()

        setRulosSaldo(saldoFila?.saldo ?? 0)

        // Solo los 5 últimos (pedido por el usuario el 23 sept 2026): con el
        // tiempo esta lista se haría muy larga, así que se limita en la
        // propia consulta en vez de traer todo el historial y recortarlo en
        // el cliente.
        const { data: movimientos } = await supabase
          .from('rulos_movimientos')
          .select('id, cantidad, motivo, nota, created_at')
          .eq('usuario_id', data.user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        setRulosMovimientos(movimientos || [])

        const { data: motivos } = await supabase.from('rulos_motivos').select('codigo, descripcion')

        const mapaMotivos = {}
        for (const motivo of motivos || []) {
          mapaMotivos[motivo.codigo] = motivo.descripcion
        }
        setRulosMotivos(mapaMotivos)

        // Ya no depende del rol guardado (Fase 7 de la unificación de
        // roles, 11 sept 2026): cualquier usuario puede haber participado
        // en sesiones y/o haberlas organizado, así que estas consultas se
        // lanzan siempre en vez de excluirse según un rol fijo.
        const { data: reservasActivas } = await supabase
          .from('reservas')
          .select('id, clases(fecha, hora)')
          .eq('cliente_id', data.user.id)
          .eq('estado', 'activa')

        setSesionesParticipante(
          (reservasActivas || []).filter((r) => claseYaPaso(r.clases)).length
        )

        const { data: clasesOrganizadas } = await supabase
          .from('clases')
          .select('fecha, hora, estado')
          .eq('trainer_id', data.user.id)
          .neq('estado', 'cancelada')

        setNumClasesOrganizadasTotal((clasesOrganizadas || []).length)
        setSesionesOrganizador(
          (clasesOrganizadas || []).filter((c) => claseYaPaso({ fecha: c.fecha, hora: c.hora })).length
        )

        const { data: valoracionesPropias } = await supabase
          .from('valoraciones')
          .select('estrellas')
          .eq('entrenador_id', data.user.id)

        const listaValoraciones = valoracionesPropias || []
        setTotalValoraciones(listaValoraciones.length)
        setPromedioValoraciones(
          listaValoraciones.length > 0
            ? listaValoraciones.reduce((suma, v) => suma + v.estrellas, 0) / listaValoraciones.length
            : null
        )

        const { data: numSeg } = await supabase.rpc('contar_mis_seguidores')
        setNumSeguidores(numSeg ?? 0)
      }
      setCargando(false)
    }
    comprobarSesion()
  }, [])

  return {
    usuario,
    setUsuario,
    cargando,
    username,
    setUsername,
    rulosSaldo,
    sesionesParticipante,
    sesionesOrganizador,
    numClasesOrganizadasTotal,
    promedioValoraciones,
    totalValoraciones,
    numSeguidores,
    rulosMovimientos,
    rulosMotivos,
    descripcionPerfil,
    fotoUrl,
    setFotoUrl,
  }
}
