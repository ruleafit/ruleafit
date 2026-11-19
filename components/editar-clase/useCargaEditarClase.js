'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { motivoNoEditableClase } from '../../lib/ventanaEdicionClase'

// Comprueba la sesión y carga la sesión a editar. Si no se puede editar,
// devuelve el motivo; si falla la carga, el error.
export default function useCargaEditarClase(id) {
  const router = useRouter()
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [cargandoClase, setCargandoClase] = useState(true)
  const [clase, setClase] = useState(null)
  const [motivoNoEditable, setMotivoNoEditable] = useState('')
  const [errorCarga, setErrorCarga] = useState('')

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
    async function cargarClase() {
      // Espera a que la comprobación de sesión termine antes de decidir
      // nada: si se entra aquí con usuario todavía sin resolver (primer
      // render), la guarda de abajo pondría cargandoClase en false
      // prematuramente, dejándolo así para siempre (nunca se vuelve a poner
      // en true) mientras la carga real de la clase sigue en marcha. Eso
      // abría el hueco de tiempo en el que el formulario podía llegar a
      // pintarse con clase todavía a null.
      if (cargandoSesion) {
        return
      }

      if (!usuario || !id) {
        setCargandoClase(false)
        return
      }

      const { data: misClases, error } = await supabase.rpc('mis_clases')

      if (error) {
        setErrorCarga(error.message)
        setCargandoClase(false)
        return
      }

      const filaClase = (misClases || []).find((c) => c.clase_id === id)
      const motivo = motivoNoEditableClase(filaClase)

      if (motivo) {
        setMotivoNoEditable(motivo)
        setCargandoClase(false)
        return
      }

      const { data: filaCompleta, error: errorCompleta } = await supabase
        .from('clases')
        .select('*')
        .eq('id', id)
        .single()

      if (errorCompleta || !filaCompleta) {
        setErrorCarga(errorCompleta?.message || 'No se han podido cargar los datos de la sesión.')
        setCargandoClase(false)
        return
      }

      setClase(filaCompleta)
      setCargandoClase(false)
    }
    cargarClase()
  }, [usuario, id, cargandoSesion])

  return {
    cargando: cargandoSesion || cargandoClase,
    clase,
    motivoNoEditable,
    errorCarga,
  }
}
