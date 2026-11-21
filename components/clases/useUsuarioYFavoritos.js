'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useBloqueados } from '../../lib/useBloqueados'

// Usuario con sesión, usuarios bloqueados y filtro "Usuarios favoritos".
export default function useUsuarioYFavoritos() {
  const [filtroSoloFavoritos, setFiltroSoloFavoritos] = useState(false)
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
  // El filtro SIEMPRE arranca desactivado: ya no se guarda ni se recupera
  // ninguna preferencia de "mantener activado". Las columnas antiguas
  // perfiles.filtro_clases_solo_seguidos (sql/065) y
  // perfiles.filtro_clases_solo_favoritos (sql/078) quedan sin uso en la
  // base de datos (no se borran) y esta pantalla no las lee.
  useEffect(() => {
    async function cargarFavoritos() {
      if (!usuario) {
        setFavoritosIds([])
        setFiltroSoloFavoritos(false)
        return
      }

      const { data: favoritos } = await supabase
        .from('favoritos')
        .select('favorito_id')
        .eq('usuario_id', usuario.id)

      setFavoritosIds((favoritos || []).map((fila) => fila.favorito_id))
    }
    cargarFavoritos()
  }, [usuario])

  return {
    usuario,
    bloqueadosIds,
    favoritosIds,
    filtroSoloFavoritos,
    setFiltroSoloFavoritos,
  }
}
