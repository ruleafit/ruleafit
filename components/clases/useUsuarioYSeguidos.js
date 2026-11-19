'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useBloqueados } from '../../lib/useBloqueados'

// Usuario con sesión, usuarios bloqueados y filtro "solo ruleros que sigo".
export default function useUsuarioYSeguidos() {
  const [filtroSoloSeguidos, setFiltroSoloSeguidos] = useState(false)
  const [filtroSoloSeguidosFijado, setFiltroSoloSeguidosFijado] = useState(false)
  const [seguidosIds, setSeguidosIds] = useState([])
  const [usuario, setUsuario] = useState(null)
  const bloqueadosIds = useBloqueados(usuario)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user || null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // Filtro "solo sesiones de ruleros a los que sigo" (pedido por el usuario
  // el 23 sept 2026): se carga la lista de a quién sigue el usuario logueado
  // (tabla public.seguimientos, lectura pública) y se filtra por
  // trainer_id en esa lista. Sin sesión iniciada no hay a quién seguir, así
  // que el botón ni se muestra y el filtro se apaga si el usuario cierra
  // sesión con el filtro activado.
  //
  // "Mantener este filtro activado siempre que entre" (pedido por el
  // usuario el 2 oct 2026): la preferencia se guarda en la cuenta, no en
  // este navegador (perfiles.filtro_clases_solo_seguidos, sql/065), para
  // que siga al usuario aunque cambie de dispositivo. Si está guardada como
  // activada, el filtro se enciende solo al entrar, sin tener que pulsar el
  // botón.
  useEffect(() => {
    async function cargarSeguidosYPreferencia() {
      if (!usuario) {
        setSeguidosIds([])
        setFiltroSoloSeguidos(false)
        setFiltroSoloSeguidosFijado(false)
        return
      }

      const [{ data: seguidos }, { data: perfil }] = await Promise.all([
        supabase.from('seguimientos').select('entrenador_id').eq('seguidor_id', usuario.id),
        supabase
          .from('perfiles')
          .select('filtro_clases_solo_seguidos')
          .eq('id', usuario.id)
          .maybeSingle(),
      ])

      setSeguidosIds((seguidos || []).map((fila) => fila.entrenador_id))

      const fijado = perfil?.filtro_clases_solo_seguidos ?? false
      setFiltroSoloSeguidosFijado(fijado)
      if (fijado) setFiltroSoloSeguidos(true)
    }
    cargarSeguidosYPreferencia()
  }, [usuario])

  async function handleCambiarFijado(nuevoValor) {
    setFiltroSoloSeguidosFijado(nuevoValor)
    if (nuevoValor) setFiltroSoloSeguidos(true)

    if (!usuario) return
    await supabase
      .from('perfiles')
      .update({ filtro_clases_solo_seguidos: nuevoValor })
      .eq('id', usuario.id)
  }

  return {
    usuario,
    bloqueadosIds,
    seguidosIds,
    filtroSoloSeguidos,
    setFiltroSoloSeguidos,
    filtroSoloSeguidosFijado,
    handleCambiarFijado,
  }
}
