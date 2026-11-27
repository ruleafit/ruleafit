'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { textoDevolucion } from '../../lib/pagos/textoDevolucion.ts'

// Bono pagado online: devolución dentro del plazo (la calcula la base de datos), estado y reclamación.
// sinSesiones = céntimos a devolver cuando ninguna sesión próxima admite el bono (sql/113); si no, undefined.
export default function EstadoBonoComprado({ id, estado, sinSesiones, onHecho, onReclamar }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  if (!estado?.cobro_id) return null
  const { devolucion, estado_cobro: cobro } = estado

  // Solo si no cabe la devolución normal, que ya devuelve lo mismo.
  const porSinSesiones = !devolucion?.puede && sinSesiones > 0

  async function pedir() {
    const importe = formatearEuros(porSinSesiones ? sinSesiones : devolucion.importe_centimos)
    if (!window.confirm(`¿Anular este bono y pedir la devolución de ${importe}? Tus reservas futuras con él se cancelan. No se puede deshacer.`)) return
    setTrabajando(true)
    setError('')
    const funcion = porSinSesiones ? 'devolver_bono_sin_sesiones' : 'solicitar_devolucion_bono'
    const { error: fallo } = await supabase.rpc(funcion, { p_bono_cliente: id })
    setTrabajando(false)
    if (fallo) setError(['P0001', 'P0002'].includes(fallo.code) ? fallo.message : 'No se ha podido pedir. Inténtalo de nuevo.')
    else onHecho()
  }

  const texto = textoDevolucion(cobro)
  return (
    <div className="mt-3 border-t border-[#E2E6CF] pt-3">
      {texto && (
        <p className="text-sm text-[#3D4A00]">
          {estado.importe_devolver_centimos ? `${formatearEuros(estado.importe_devolver_centimos)}: ` : ''}
          {cobro === 'requiere_reembolso' ? 'devolución en marcha. Puede tardar unos días en verse en tu cuenta.' : texto}
        </p>
      )}
      {porSinSesiones && (
        <p className="mb-2 text-sm font-medium text-[#3D4A00]">
          Ninguna sesión próxima admite este bono. Puedes pedir gratis la devolución de lo no usado.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {(devolucion?.puede || porSinSesiones) && (
          <button type="button" disabled={trabajando} onClick={pedir} className="corte-tag border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Pedir devolución de {formatearEuros(porSinSesiones ? sinSesiones : devolucion.importe_centimos)}
          </button>
        )}
        {!devolucion?.puede && !porSinSesiones && cobro === 'pagado' && <p className="text-xs text-[#6B7355]">{devolucion?.motivo}</p>}
        {onReclamar && (
          <button type="button" onClick={() => onReclamar(estado.cobro_id)} className="text-xs font-semibold text-[#3D4A00] underline">
            Reclamar un cobro o reembolso
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
