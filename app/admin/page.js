'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const MENSAJES = {
  'sin-sesion': 'Inicia sesión con una cuenta de administrador.',
  'sin-acceso': 'No tienes acceso a esta página.',
  error: 'No se pudo cargar el panel.',
}

// Portada de administración. El permiso lo decide el servidor.
export default function AdminPage() {
  const [estado, setEstado] = useState('cargando') // cargando | ok | sin-sesion | sin-acceso | error
  const [secciones, setSecciones] = useState([])

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return setEstado('sin-sesion')
      const respuesta = await fetch('/api/admin/resumen?pendientes=1', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch(() => null)
      const json = await respuesta?.json().catch(() => null)
      if (!respuesta?.ok || !json) return setEstado('error')
      if (!json.admin) return setEstado('sin-acceso')
      setSecciones(json.secciones)
      setEstado('ok')
    }
    cargar()
  }, [])

  if (estado === 'cargando') return <p className="p-8 text-center text-[#6B7355]">Cargando…</p>
  if (estado !== 'ok') {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-[#1F2400]">{MENSAJES[estado]}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#3D4A00] underline">Volver al inicio</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-[#1F2400]">Administración</h1>
      <ul className="flex flex-col gap-3">
        {secciones.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center justify-between gap-4 corte-btn border-2 border-[#B5E600] bg-white px-5 py-4 transition-colors hover:bg-[#F5F7E8]"
            >
              <span>
                <span className="block text-base font-bold text-[#3D4A00]">{s.titulo}</span>
                <span className="block text-sm text-[#6B7355]">{s.descripcion}</span>
              </span>
              {s.pendientes != null && (
                <span
                  aria-label={`${s.pendientes} pendientes`}
                  className={`inline-flex min-w-9 justify-center corte-tag px-2.5 py-1 text-sm font-extrabold ${s.pendientes > 0 ? 'bg-[#B5E600] text-[#1F2400]' : 'bg-[#F1F1EC] text-[#6B7355]'}`}
                >
                  {s.pendientes}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
