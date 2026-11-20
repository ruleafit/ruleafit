'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useBloqueados } from '../../lib/useBloqueados'

// Usuario con sesión, usuarios bloqueados y filtro "Usuarios favoritos".
export default function useUsuarioYFavoritos() {
  const [filtroSoloFavoritos, setFiltroSoloFavoritos] = useState(false)
  const [filtroSoloFavoritosFijado, setFiltroSoloFavoritosFijado] = useState(false)
  const [favoritosIds, setFavoritosIds] = useState([])
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

  // Filtro "Usuarios favoritos": antes (23 sept 2026) usaba a quién sigue el
  // usuario (public.seguimientos); ahora usa SOLO su lista privada de
  // favoritos (public.favoritos, sql/078), independiente de Seguir. Se carga
  // la lista del usuario logueado y se filtra por trainer_id. Sin sesión no
  // hay favoritos: el botón no se muestra y el filtro se apaga.
  //
  // "Mantener este filtro activado siempre que entre": la preferencia se
  // guarda en la cuenta (perfiles.filtro_clases_solo_favoritos, sql/078; la
  // columna de seguidos de sql/065 queda sin uso) para que siga al usuario
  // aunque cambie de dispositivo.
  useEffect(() => {
    async function cargarFavoritosYPreferencia() {
      if (!usuario) {
        setFavoritosIds([])
        setFiltroSoloFavoritos(false)
        setFiltroSoloFavoritosFijado(false)
        return
      }

      const [{ data: favoritos }, { data: perfil }] = await Promise.all([
        supabase.from('favoritos').select('favorito_id').eq('usuario_id', usuario.id),
        supabase
          .from('perfiles')
          .select('filtro_clases_solo_favoritos')
          .eq('id', usuario.id)
          .maybeSingle(),
      ])

      setFavoritosIds((favoritos || []).map((fila) => fila.favorito_id))

      const fijado = perfil?.filtro_clases_solo_favoritos ?? false
      setFiltroSoloFavoritosFijado(fijado)
      if (fijado) setFiltroSoloFavoritos(true)
    }
    cargarFavoritosYPreferencia()
  }, [usuario])

  async function handleCambiarFijado(nuevoValor) {
    setFiltroSoloFavoritosFijado(nuevoValor)
    if (nuevoValor) setFiltroSoloFavoritos(true)

    if (!usuario) return
    await supabase
      .from('perfiles')
      .update({ filtro_clases_solo_favoritos: nuevoValor })
      .eq('id', usuario.id)
  }

  return {
    usuario,
    bloqueadosIds,
    favoritosIds,
    filtroSoloFavoritos,
    setFiltroSoloFavoritos,
    filtroSoloFavoritosFijado,
    handleCambiarFijado,
  }
}
