'use client'

import { useEffect, useState } from 'react'
import { iniciarPago } from '../../lib/iniciarPago'
import { formatearEuros } from '../../lib/pagos/dinero.ts'

const boton = 'corte-btn bg-[#B5E600] px-4 py-2 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60'

// Compra online de un bono (sql/107): primero las condiciones y el total; el importe lo calcula la base de datos.
export default function CompraBono({ bono }) {
  const [abierto, setAbierto] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [error, setError] = useState('')
  const centimos = Math.round(Number(bono.precio) * 100)

  useEffect(() => {
    const volver = () => setPagando(false)
    window.addEventListener('pageshow', volver)
    return () => window.removeEventListener('pageshow', volver)
  }, [])

  async function pagar(metodo) {
    setPagando(true)
    setError('')
    const fallo = await iniciarPago('/api/payments/crear', { bonoId: bono.id, metodo, totalCentimos: centimos })
    if (fallo) {
      setError(fallo)
      setPagando(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`${boton} shrink-0`}>
        Comprar
      </button>
    )
  }

  return (
    <div className="w-full corte-card border border-[#B5E600] bg-[#FBFAF3] p-4 sm:basis-full">
      <p className="text-sm font-bold text-[#1F2400]">Total: {formatearEuros(centimos)}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#6B7355]">
        <li>Quien organiza indica en cada sesión si admite este bono. Si ninguna sesión próxima lo admite, puedes pedir gratis la devolución de lo no usado.</li>
        <li>Con el bono reservas sin volver a pagar. Las sesiones canceladas con menos de 2 horas cuentan como usadas.</li>
        <li>Puedes pedir la devolución en los 14 días desde la compra: íntegra sin usar ninguna sesión, o de la parte no usada si has usado como mucho el 25 %.</li>
        <li>Si quien organiza anula el bono, te bloquea o deja de dar el servicio, se te devuelve la parte no usada.</li>
        <li>{bono.plazo_dias > 0 ? `Caduca a los ${bono.plazo_dias} días: las sesiones sin usar no se devuelven.` : 'No caduca.'}</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={pagando} onClick={() => pagar('tarjeta')} className={boton}>
          {pagando ? 'Abriendo el pago...' : 'Pagar con tarjeta'}
        </button>
        <button type="button" disabled={pagando} onClick={() => pagar('bizum')} className={boton}>
          Pagar con Bizum
        </button>
        <button type="button" disabled={pagando} onClick={() => setAbierto(false)} className="px-3 py-2 text-sm font-semibold text-[#6B7355]">
          Volver
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
