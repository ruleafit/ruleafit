'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const legible = (e) => (['P0001', 'P0002'].includes(e.code) ? e.message : 'No se ha podido completar. Inténtalo de nuevo.')

// Con pagos activos: aviso de Pro y salida ordenada (anular y devolver lo no usado).
export function AvisoPro({ pro }) {
  if (!pro || pro.activa) return null
  return (
    <p className="mb-6 corte-card border border-amber-300 bg-amber-50 p-3 text-sm text-[#1F2400]">
      Para crear y vender bonos necesitas el Plan Pro y tus datos fiscales aprobados. Los bonos ya vendidos siguen
      funcionando. <Link href="/pro" className="font-semibold underline">Ver el Plan Pro</Link>
    </p>
  )
}

export function AnularBonos({ hayVendidos, onHecho }) {
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  async function anular() {
    if (!window.confirm('¿Anular todos tus bonos y devolver a cada alumno la parte no usada? Se quitan de la venta y sus reservas futuras con bono se cancelan. No se puede deshacer.')) return
    setTrabajando(true)
    const { data, error } = await supabase.rpc('cancelar_mis_bonos')
    setTrabajando(false)
    setMensaje(error ? legible(error) : `Hecho. Devoluciones en marcha: ${data.devoluciones}.`)
    if (!error) onHecho()
  }

  if (!hayVendidos) return null
  return (
    <div className="mt-6">
      <button type="button" disabled={trabajando} onClick={anular} className="corte-tag border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
        Cancelar mis bonos y devolver lo no usado
      </button>
      {mensaje && <p role="status" className="mt-2 text-sm text-[#3D4A00]">{mensaje}</p>}
    </div>
  )
}

export function AccionComprador({ estado, comprador, onHecho }) {
  const [error, setError] = useState('')
  if (estado?.anulado) return <span className="text-xs font-semibold text-red-600">Anulado</span>
  if (!estado?.anulable) return null

  async function anular() {
    if (!window.confirm(`¿Anular el bono de @${comprador} y devolverle la parte no usada? No se puede deshacer.`)) return
    const { error: fallo } = await supabase.rpc('cancelar_bono_vendido', { p_bono_cliente: estado.id })
    if (fallo) setError(legible(fallo))
    else onHecho()
  }

  return (
    <span className="text-xs">
      <button type="button" onClick={anular} className="font-semibold text-red-700 underline">Anular y devolver</button>
      {error && <span className="ml-2 text-red-600">{error}</span>}
    </span>
  )
}
