'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { alternarBono } from '../../lib/bonosSesion'
import { labelClass, ayudaClass } from './constantes'

const casilla = 'flex cursor-pointer items-start gap-2.5 text-sm text-[#1F2400]'

function nombreBono(b) {
  const sesiones = b.numero_sesiones == null ? 'Sesiones ilimitadas' : `${b.numero_sesiones} sesiones`
  const partes = [sesiones, `${Number(b.precio).toLocaleString('es-ES')} €`, b.plazo_dias > 0 ? `${b.plazo_dias} días` : 'sin caducidad']
  return partes.join(' · ') + (b.activo ? '' : ' (ya no a la venta)')
}

// Si la sesión se puede reservar con bono y con cuáles (sql/113). valor: null = todos mis bonos, [] = ninguno,
// lista = solo esos. No se muestra a quien no tiene bonos.
export default function SelectorBonos({ valor, onCambio }) {
  const [bonos, setBonos] = useState([])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const { data: sesion } = await supabase.auth.getUser()
      if (!sesion.user) return
      const { data } = await supabase
        .from('bonos')
        .select('id, numero_sesiones, plazo_dias, precio, descripcion, activo')
        .eq('trainer_id', sesion.user.id)
        .order('created_at')
      if (!cancelado) setBonos(data || [])
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  if (bonos.length === 0) return null
  const ids = bonos.map((b) => b.id)
  const admite = valor === null || valor.length > 0

  return (
    <fieldset>
      <legend className={labelClass}>Bonos</legend>
      <label className={casilla}>
        <input type="checkbox" checked={admite} onChange={() => onCambio(admite ? [] : null)} className="mt-0.5 h-4 w-4 accent-[#3D4A00]" />
        <span className="font-semibold">Se puede reservar con bono</span>
      </label>
      {admite && (
        <div className="mt-2 flex flex-col gap-2 border-l-2 border-[#E2E6CF] pl-4">
          {bonos.map((b) => (
            <label key={b.id} className={casilla}>
              <input
                type="checkbox"
                checked={valor === null || valor.includes(b.id)}
                onChange={() => onCambio(alternarBono(valor, b.id, ids))}
                className="mt-0.5 h-4 w-4 accent-[#3D4A00]"
              />
              <span>
                {nombreBono(b)}
                {b.descripcion && <span className="block text-xs text-[#6B7355]">{b.descripcion}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
      <p className={ayudaClass}>
        {valor === null
          ? 'Valen todos tus bonos, también los que crees después.'
          : valor.length === 0
            ? 'Esta sesión no se podrá reservar con bono.'
            : 'Solo valen los bonos marcados. Los que crees después no se añaden solos.'}
      </p>
    </fieldset>
  )
}
