'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { codigoInvitacionValido, guardarInvitacion } from '../../../lib/invitacion'

const botonPrimario =
  'inline-flex w-full items-center justify-center corte-btn bg-[#B5E600] px-6 py-3 text-base font-bold text-[#1F2400] transition hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'

// C25 · Página de bienvenida de un enlace de invitación (/invita/<código>). Pide al servidor un billete de un solo uso
// (solo si el código existe), lo recuerda para el registro y ofrece crear cuenta. No concede nada por sí sola: los Rulos
// los concede el servidor cuando se completa un registro NUEVO (cuenta creada después de abrir el enlace). Quien ya tiene
// cuenta puede iniciar sesión, sin recompensa.
export default function InvitacionPage() {
  const { codigo: codigoUrl } = useParams()
  const codigo = String(codigoUrl || '').toUpperCase()
  const [estado, setEstado] = useState('comprobando') // comprobando | valida | invalida
  const [conSesion, setConSesion] = useState(false)

  useEffect(() => {
    let vivo = true
    async function comprobar() {
      const { data: sesion } = await supabase.auth.getSession()
      if (!vivo) return
      setConSesion(!!sesion.session)
      if (!codigoInvitacionValido(codigo)) {
        setEstado('invalida')
        return
      }
      if (sesion.session) {
        // Con la sesión ya iniciada no se emite ningún billete: las invitaciones solo valen para cuentas nuevas.
        setEstado('valida')
        return
      }
      // El servidor emite un billete de un solo uso que recuerda CUÁNDO se abrió el enlace (null si el código no existe).
      const { data: billete } = await supabase.rpc('abrir_invitacion', { p_codigo: codigo })
      if (!vivo) return
      if (billete && guardarInvitacion(billete)) {
        setEstado('valida')
      } else {
        setEstado('invalida')
      }
    }
    comprobar()
    return () => {
      vivo = false
    }
  }, [codigo])

  return (
    <div className="flex flex-1 flex-col items-center bg-[#F7F9EC] px-4 py-12 sm:py-16">
      <div className="w-full max-w-md corte-card border border-[#E2E6CF] bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1F00]">
          <Gift className="h-7 w-7 text-[#B5E600]" strokeWidth={1.75} aria-hidden="true" />
        </span>

        {estado === 'comprobando' && <p className="mt-6 text-sm text-[#6B7355]">Comprobando tu invitación…</p>}

        {estado === 'invalida' && (
          <>
            <h1 className="mt-5 text-2xl font-extrabold text-[#1F2400]">Este enlace de invitación no es válido</h1>
            <p className="mt-3 text-sm text-[#3d4426]">
              Puede que esté mal copiado. Aun así, puedes unirte a RuleaFit y descubrir actividades deportivas cerca de ti.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/registro" className={botonPrimario}>Crear cuenta</Link>
              <Link href="/clases" className="text-sm font-semibold text-[#3D4A00] underline underline-offset-2">Ver sesiones</Link>
            </div>
          </>
        )}

        {estado === 'valida' && (
          <>
            <h1 className="mt-5 text-2xl font-extrabold text-[#1F2400] sm:text-3xl">¡Te han invitado a RuleaFit!</h1>
            <p className="mt-3 text-base text-[#3d4426]">
              Descubre actividades deportivas, conecta con otros ruleros y gana tus primeros Rulos.
            </p>
            <p className="mt-4 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-4 py-3 text-sm font-semibold text-[#3D4A00]">
              Consigue 20 Rulos extra al registrarte con esta invitación. La persona que te ha invitado también recibirá 20 Rulos.
            </p>
            <p className="mt-2 text-xs text-[#6B7355]">
              Son adicionales a los 20 Rulos de bienvenida que ya recibe todo usuario nuevo: ¡40 en total!
            </p>

            {conSesion ? (
              <>
                <p className="mt-5 text-sm text-[#6B7355]">
                  Ya has iniciado sesión en RuleaFit. Las invitaciones solo dan Rulos a cuentas nuevas.
                </p>
                <Link href="/" className={`${botonPrimario} mt-4`}>Ir a RuleaFit</Link>
              </>
            ) : (
              <>
                <Link href="/registro" className={`${botonPrimario} mt-6`}>Crear cuenta y conseguir 20 Rulos extra</Link>
                <p className="mt-4 text-sm text-[#6B7355]">
                  ¿Ya tienes cuenta?{' '}
                  <Link href="/login" className="font-semibold text-[#3D4A00] hover:underline">Inicia sesión</Link>
                </p>
                <p className="mt-1 text-xs text-[#6B7355]">Si ya tenías cuenta, la invitación no da Rulos.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
