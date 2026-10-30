'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Ids de los usuarios que ha bloqueado el usuario actual (tabla bloqueos,
// sql/068). Si no hay sesión, o la tabla aún no existe, devuelve una lista
// vacía y la web funciona como si no hubiera bloqueos.
export function useBloqueados(usuario) {
  const [bloqueadosIds, setBloqueadosIds] = useState([])

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (!usuario) {
        setBloqueadosIds([])
        return
      }
      const { data, error } = await supabase
        .from('bloqueos')
        .select('bloqueado_id')
        .eq('bloqueador_id', usuario.id)

      if (!cancelado) {
        setBloqueadosIds(error ? [] : (data || []).map((fila) => fila.bloqueado_id))
      }
    }
    cargar()

    return () => {
      cancelado = true
    }
  }, [usuario])

  return bloqueadosIds
}
