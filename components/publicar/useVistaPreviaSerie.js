'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fechaValida, validarSerie } from '../../lib/seriesSesiones'

// Vista previa de la serie en el formulario de publicar: valida con las mismas reglas que se usarán
// al publicar y calcula las sesiones reales. Además consulta las sesiones activas del organizador en
// el mismo periodo para avisar de duplicados o solapes (solo aviso: puede ser intencionado).
export default function useVistaPreviaSerie(c) {
  const [existentes, setExistentes] = useState([])
  const rangoValido = c.repetir && fechaValida(c.repInicio) && fechaValida(c.repFin) && c.repFin >= c.repInicio

  useEffect(() => {
    if (!rangoValido) {
      setExistentes([])
      return undefined
    }
    let cancelado = false
    const espera = setTimeout(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user || cancelado) return
      const { data } = await supabase
        .from('clases')
        .select('fecha, hora, duracion, titulo')
        .eq('trainer_id', u.user.id)
        .eq('estado', 'activa')
        .gte('fecha', c.repInicio)
        .lte('fecha', c.repFin)
        .limit(1000)
      if (!cancelado) setExistentes(data || [])
    }, 400)
    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [rangoValido, c.repInicio, c.repFin])

  const validacion = useMemo(() => {
    if (!c.repetir) return { errores: [], avisos: [], sesiones: [] }
    return validarSerie({
      patron: c.patron,
      inicio: c.repInicio,
      fin: c.repFin,
      duracion: c.duracion === '' ? null : Number(c.duracion),
      existentes,
    })
  }, [c.repetir, c.patron, c.repInicio, c.repFin, c.duracion, existentes])

  return { validacion, patron: c.patron, inicio: c.repInicio, fin: c.repFin }
}
