'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { iniciarPago } from '../../lib/iniciarPago'
import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearMomentoParaMostrar } from '../../lib/formatoFecha'
import usePro from './usePro'
import HistorialPro from './HistorialPro'

const boton = 'corte-btn bg-[#B5E600] px-5 py-2.5 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60'
const botonSecundario = 'corte-btn border border-[#E2E6CF] px-5 py-2.5 text-sm font-semibold text-[#3D4A00] hover:border-[#B5E600] disabled:opacity-60'

// Alta, cancelación y devolución del Plan Pro.
export default function PantallaPro() {
  const { estado, pro, cargar } = usePro()
  const [acepta, setAcepta] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const pago = new URLSearchParams(window.location.search).get('pago')
    if (pago === 'ok') setAviso('Pago enviado. Si no ves Pro activo, recarga en unos segundos.')
    if (pago === 'ko') setAviso('El pago no se ha completado. No se te ha cobrado nada.')
  }, [])

  // «Atrás» desde el banco: se desbloquean los botones.
  useEffect(() => {
    const volver = () => setTrabajando(false)
    window.addEventListener('pageshow', volver)
    return () => window.removeEventListener('pageshow', volver)
  }, [])

  async function contratar() {
    setTrabajando(true)
    setError('')
    const fallo = await iniciarPago('/api/payments/pro', { totalCentimos: pro.precio_centimos })
    if (fallo) {
      setError(fallo)
      setTrabajando(false)
    }
  }

  async function llamar(funcion, pregunta, hecho) {
    if (pregunta && !window.confirm(pregunta)) return
    setTrabajando(true)
    setError('')
    setAviso('')
    const { error: fallo } = await supabase.rpc(funcion)
    if (fallo) setError(['P0001', 'P0002'].includes(fallo.code) ? fallo.message : 'No se ha podido completar. Inténtalo de nuevo.')
    else setAviso(hecho)
    await cargar()
    setTrabajando(false)
  }

  if (estado === 'cargando') return <p className="px-4 py-16 text-center text-[#6B7355]">Cargando...</p>
  if (estado === 'sin_sesion') {
    return (
      <p className="px-4 py-16 text-center text-[#6B7355]">
        <Link href="/login" className="font-semibold text-[#3D4A00] underline">Inicia sesión</Link> para ver el Plan Pro.
      </p>
    )
  }
  if (estado === 'error') return <p className="px-4 py-16 text-center text-red-600">No hemos podido cargar tu suscripción.</p>

  const precio = formatearEuros(pro.precio_centimos)
  const hasta = pro.periodo_fin ? formatearMomentoParaMostrar(pro.periodo_fin) : ''
  const desistimiento = pro.desistimiento?.puede ? formatearEuros(pro.desistimiento.importe_centimos) : null

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold text-[#1F2400]">Plan Pro</h1>
      <p className="mt-2 text-sm text-[#6B7355]">
        {precio} al mes. Con Pro puedes crear y vender bonos de sesiones. Sin prueba gratuita ni permanencia.
      </p>
      {aviso && <p role="status" className="mt-4 corte-card border border-[#B5E600] bg-[#EDF5C9] p-3 text-sm text-[#1F2400]">{aviso}</p>}

      <section className="mt-6 corte-card border border-[#E2E6CF] bg-white p-5">
        {pro.activa ? (
          <>
            <p className="text-base font-bold text-[#1F2400]">Pro activo</p>
            {pro.estado === 'impagada' ? (
              <p className="mt-1 text-sm text-red-600">
                No se ha podido cobrar el último mes. Se reintenta cada día durante {pro.gracia_dias} días; después Pro caduca.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#6B7355]">
                {pro.renovacion ? `Se renueva el ${hasta} por ${precio}.` : `Renovación cancelada. Pro sigue activo hasta el ${hasta}.`}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {pro.renovacion && (
                <button type="button" disabled={trabajando} className={botonSecundario}
                  onClick={() => llamar('cancelar_pro', `¿Cancelar la renovación? No se te volverá a cobrar y Pro seguirá activo hasta el ${hasta}.`, 'Renovación cancelada. No se te volverá a cobrar.')}>
                  Cancelar la renovación
                </button>
              )}
              {pro.puede_reactivar && (
                <button type="button" disabled={trabajando} className={boton}
                  onClick={() => llamar('reactivar_pro', null, 'Renovación reactivada.')}>
                  Reactivar la renovación
                </button>
              )}
              {desistimiento && (
                <button type="button" disabled={trabajando} className={botonSecundario}
                  onClick={() => llamar('desistir_pro', `¿Darte de baja ahora y pedir la devolución de ${desistimiento}? Pro termina en este momento.`, `Baja hecha. Devolveremos ${desistimiento} a tu tarjeta.`)}>
                  Darme de baja con devolución de {desistimiento}
                </button>
              )}
            </div>
          </>
        ) : !pro.fiscal_activo ? (
          <p className="text-sm text-[#1F2400]">
            Antes de contratar Pro necesitas tus datos fiscales aprobados en{' '}
            <Link href="/cuenta" className="font-semibold underline">Mi cuenta → Tu perfil → Datos fiscales y cobros</Link>.
          </p>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm text-[#1F2400]">
              <input type="checkbox" className="mt-1" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                Autorizo el cobro de {precio} cada mes en mi tarjeta hasta que cancele, y quiero que el servicio empiece ya.
                Puedo cancelar la renovación desde esta pantalla en cualquier momento.
              </span>
            </label>
            <button type="button" disabled={!acepta || trabajando} onClick={contratar} className={`${boton} mt-4`}>
              {trabajando ? 'Abriendo el pago...' : `Contratar Pro por ${precio} al mes`}
            </button>
            <p className="mt-2 text-xs text-[#6B7355]">Pago con tarjeta en la pasarela del banco. Ruleafit no ve los datos de tu tarjeta.</p>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <p className="mt-4 text-xs text-[#6B7355]">
        Si Pro caduca o lo cancelas, no podrás crear ni vender bonos nuevos; los ya vendidos siguen funcionando. En los 14
        días siguientes a tu primera contratación puedes darte de baja con devolución: íntegra si no has vendido ningún bono
        y proporcional a los días no disfrutados si has vendido alguno.
      </p>
      <HistorialPro pagos={pro.pagos} />
    </div>
  )
}
