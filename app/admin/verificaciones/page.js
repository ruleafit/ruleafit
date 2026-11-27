'use client'

import { useState } from 'react'
import Link from 'next/link'
import useColaVerificaciones from '../../../components/verificaciones/admin/useColaVerificaciones'
import TarjetaSolicitud from '../../../components/verificaciones/admin/TarjetaSolicitud'

const MENSAJES = {
  'sin-sesion': 'Inicia sesión con una cuenta de administrador.',
  'sin-acceso': 'No tienes acceso a esta página.',
  error: 'No se pudieron cargar las solicitudes.',
}

// Cola de verificaciones. La comprobación de administrador la hace el servidor.
export default function VerificacionesAdminPage() {
  const { estado, cola, resolver } = useColaVerificaciones()
  const [soloPendientes, setSoloPendientes] = useState(true)

  if (estado === 'cargando') return <p className="p-8 text-center text-[#6B7355]">Cargando…</p>
  if (estado !== 'ok') {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-[#1F2400]">{MENSAJES[estado]}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#3D4A00] underline">Volver al inicio</Link>
      </div>
    )
  }

  const secciones = [
    { tipo: 'identidad', titulo: 'Identidad', filas: cola.identidades },
    { tipo: 'titulacion', titulo: 'Titulaciones', filas: cola.titulaciones },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Verificaciones</h1>
      <label className="mb-6 mt-3 flex items-center gap-2 text-sm text-[#1F2400]">
        <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="accent-[#B5E600]" />
        Solo pendientes
      </label>

      {secciones.map(({ tipo, titulo, filas }) => {
        const visibles = filas.filter((f) => !soloPendientes || f.estado === 'pendiente')
        return (
          <section key={tipo} className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-[#3D4A00]">
              {titulo} · pendientes: {filas.filter((f) => f.estado === 'pendiente').length}
            </h2>
            {visibles.length === 0 && <p className="text-sm text-[#6B7355]">No hay solicitudes que mostrar.</p>}
            <ul className="flex flex-col gap-4">
              {visibles.map((s) => (
                <TarjetaSolicitud key={`${s.id}-${s.estado}`} tipo={tipo} solicitud={s} onResolver={resolver} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
