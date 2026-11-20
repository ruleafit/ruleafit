'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useBloqueados } from '../../lib/useBloqueados'

// Carga de Ruleros: usuario, directorio completo (listar_entrenadores
// devuelve a TODOS los perfiles, así la búsqueda descubre a cualquiera),
// y las dos listas del usuario: favoritos (privada, sql/078) y seguidos.
export default function useRuleros() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [ruleros, setRuleros] = useState([])
  const [favoritosIds, setFavoritosIds] = useState([])
  const [seguidosIds, setSeguidosIds] = useState([])
  const [error, setError] = useState('')
  const bloqueadosIds = useBloqueados(usuario)

  useEffect(() => {
    async function cargar() {
      const { data: userData } = await supabase.auth.getUser()
      const usuarioActual = userData.user || null
      setUsuario(usuarioActual)

      // Cualquier usuario logueado puede ver el directorio.
      if (usuarioActual) {
        const [{ data, error: errorRpc }, { data: favoritos }, { data: seguidos }] = await Promise.all([
          supabase.rpc('listar_entrenadores'),
          supabase.from('favoritos').select('favorito_id').eq('usuario_id', usuarioActual.id),
          supabase.from('seguimientos').select('entrenador_id').eq('seguidor_id', usuarioActual.id),
        ])

        if (errorRpc) setError('Error al cargar los ruleros: ' + errorRpc.message)
        else setRuleros(data || [])
        setFavoritosIds((favoritos || []).map((fila) => fila.favorito_id))
        setSeguidosIds((seguidos || []).map((fila) => fila.entrenador_id))
      }

      setCargando(false)
    }
    cargar()
  }, [])

  const visibles = ruleros.filter((r) => !bloqueadosIds.includes(r.id))

  return { usuario, cargando, error, ruleros: visibles, totalRuleros: ruleros.length, favoritosIds, seguidosIds }
}
