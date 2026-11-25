'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X } from 'lucide-react'
import { guardarRetorno } from '../../lib/retorno'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'

const botonPrimario =
  'flex w-full items-center justify-center corte-btn bg-[#B5E600] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2'
const botonSecundario =
  'flex w-full items-center justify-center corte-btn border-2 border-[#1F2400] px-6 py-3 text-sm font-bold text-[#1F2400] transition-colors hover:bg-[#EDF5C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600] focus-visible:ring-offset-2'

// C03 · Panel para visitantes que pulsan «Reservar». Solo recuerda la sesión (ruta interna, validada) y lleva a
// los formularios de registro / inicio de sesión de siempre; no reserva nada ni crea sesiones por su cuenta.
// Panel inferior en móvil, ventana centrada en escritorio.
// intencion: 'reservar' (por defecto), 'avisar' (C15: activar un aviso de plaza) o, con `perfil={{ username }}`, 'seguir' /
// 'favorito' (C25: perfil público de un rulero; son dos acciones distintas y no se mezclan).
export default function PanelIdentificacion({ clase, perfil, onCerrar, intencion = 'reservar' }) {
  const avisar = intencion === 'avisar'
  const esPerfil = !!perfil
  const ref = useRef(null)
  const cerrarRef = useRef(onCerrar)
  cerrarRef.current = onCerrar
  const ruta = esPerfil ? `/entrenador/${perfil.username}` : `/clases/${clase.id}`
  const precio = esPerfil ? 0 : Number(clase.precio)

  useEffect(() => {
    const anterior = document.activeElement
    ref.current?.focus()
    function alTeclear(e) {
      if (e.key === 'Escape') cerrarRef.current()
    }
    document.addEventListener('keydown', alTeclear)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
  }, [])

  function recordar() {
    guardarRetorno({ ruta, titulo: esPerfil ? `@${perfil.username}` : clase.titulo || '', intencion })
  }

  // En un portal: las tarjetas de Explora tienen transformaciones CSS que atraparían un panel fixed.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-identificacion-titulo"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl outline-none sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-full p-1.5 text-[#6B7355] hover:bg-[#F4FAD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <h2 id="panel-identificacion-titulo" className="pr-8 text-xl font-extrabold text-[#1F2400]">
          {esPerfil
            ? intencion === 'favorito'
              ? `¡Estás a un paso de añadir a @${perfil.username} a favoritos!`
              : `¡Estás a un paso de seguir a @${perfil.username}!`
            : avisar
              ? '¡Estás a un paso de activar tu aviso!'
              : '¡Estás a un paso de reservar!'}
        </h2>

        {esPerfil ? (
          <p className="mt-4 rounded-xl border border-[#E2E6CF] bg-[#F7F9EC] p-4 text-sm font-bold text-[#1F2400]">@{perfil.username}</p>
        ) : (
          <dl className="mt-4 space-y-1 rounded-xl border border-[#E2E6CF] bg-[#F7F9EC] p-4 text-sm">
            <div className="font-bold text-[#1F2400]">{clase.titulo}</div>
            <div className="text-[#6B7355]">
              {formatearFechaParaMostrar(clase.fecha)} · {String(clase.hora).slice(0, 5)}
            </div>
            <div className="font-semibold text-[#1F2400]">{precio > 0 ? `${clase.precio} €` : 'Gratis'}</div>
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <Link href={`/registro?volver=${ruta}&intencion=${intencion}`} onClick={recordar} className={botonPrimario}>
            Soy nuevo
          </Link>
          <Link href={`/login?volver=${ruta}&intencion=${intencion}`} onClick={recordar} className={botonSecundario}>
            Ya tengo cuenta
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-[#6B7355]">
          {esPerfil
            ? 'Podrás usar Google o tu correo. Al terminar volverás a este perfil y confirmarás tú mismo la acción: no se activa nada antes.'
            : avisar
              ? 'Podrás usar Google o tu correo. Al terminar volverás a esta sesión y confirmarás tú mismo la activación del aviso. El aviso no reserva ni garantiza una plaza.'
              : 'Podrás usar Google o tu correo. Al terminar volverás a esta sesión y confirmarás tu reserva tú mismo: no se reserva nada antes.'}
        </p>
      </div>
    </div>,
    document.body
  )
}
