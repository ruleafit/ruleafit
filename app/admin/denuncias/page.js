'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'

const MOTIVOS = {
  contenido_inapropiado: 'Contenido inapropiado u ofensivo',
  estafa: 'Estafa o engaño',
  suplantacion: 'Suplantación de identidad',
  acoso: 'Acoso o comportamiento abusivo',
  peligro: 'Peligro para la seguridad',
  otro: 'Otro motivo',
}

const COLOR_ESTADO = {
  pendiente: 'bg-[#FDECEA] text-red-800 border-red-200',
  revisada: 'bg-[#EDF5C9] text-[#3D4A00] border-[#B5E600]/60',
  descartada: 'bg-[#F1F1EC] text-[#6B7355] border-[#E2E6CF]',
}

// Panel de revisión de denuncias. Solo lo ve un administrador: la comprobación
// real la hace el servidor (app/api/admin/denuncias, lib/adminAuth.js); esta
// página solo pide los datos y muestra "sin acceso" si el servidor los niega.
export default function DenunciasAdminPage() {
  const [estadoCarga, setEstadoCarga] = useState('cargando') // cargando | ok | sin-sesion | sin-acceso | error
  const [denuncias, setDenuncias] = useState([])
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [trabajando, setTrabajando] = useState(null)

  const pedir = useCallback(async (metodo, cuerpo) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { sinSesion: true }
    const respuesta = await fetch('/api/admin/denuncias', {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
    return { respuesta }
  }, [])

  const cargar = useCallback(async () => {
    const { sinSesion, respuesta } = await pedir('GET')
    if (sinSesion) return setEstadoCarga('sin-sesion')
    if (respuesta.status === 403) return setEstadoCarga('sin-acceso')
    if (!respuesta.ok) return setEstadoCarga('error')
    const json = await respuesta.json()
    setDenuncias(json.denuncias || [])
    setEstadoCarga('ok')
  }, [pedir])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function cambiarEstado(id, estado) {
    setTrabajando(id)
    const { respuesta } = await pedir('PATCH', { id, estado })
    setTrabajando(null)
    if (respuesta?.ok) {
      setDenuncias((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)))
    }
  }

  const visibles = denuncias.filter((d) => !soloPendientes || d.estado === 'pendiente')

  if (estadoCarga === 'cargando') {
    return <p className="p-8 text-center text-[#6B7355]">Cargando…</p>
  }
  if (estadoCarga !== 'ok') {
    const texto =
      estadoCarga === 'sin-sesion'
        ? 'Inicia sesión con una cuenta de administrador.'
        : estadoCarga === 'sin-acceso'
          ? 'No tienes acceso a esta página.'
          : 'No se pudieron cargar las denuncias.'
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p className="text-[#1F2400]">{texto}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#3D4A00] underline">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-extrabold text-[#1F2400]">Denuncias</h1>
      <div className="mt-4 mb-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setSoloPendientes(true)}
          className={`corte-tag border px-3 py-1 font-semibold ${soloPendientes ? 'border-[#B5E600] bg-[#EDF5C9] text-[#3D4A00]' : 'border-[#E2E6CF] text-[#6B7355]'}`}
        >
          Pendientes ({denuncias.filter((d) => d.estado === 'pendiente').length})
        </button>
        <button
          type="button"
          onClick={() => setSoloPendientes(false)}
          className={`corte-tag border px-3 py-1 font-semibold ${!soloPendientes ? 'border-[#B5E600] bg-[#EDF5C9] text-[#3D4A00]' : 'border-[#E2E6CF] text-[#6B7355]'}`}
        >
          Todas ({denuncias.length})
        </button>
      </div>

      {visibles.length === 0 && <p className="text-sm text-[#6B7355]">No hay denuncias que mostrar.</p>}

      <ul className="flex flex-col gap-4">
        {visibles.map((d) => (
          <li key={d.id} className="corte-card border border-[#E2E6CF] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`corte-tag border px-2.5 py-0.5 text-xs font-bold ${COLOR_ESTADO[d.estado]}`}>{d.estado}</span>
              <span className="text-xs text-[#6B7355]">{new Date(d.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
            </div>

            <p className="mt-2 text-sm text-[#1F2400]">
              <strong>{d.tipo === 'sesion' ? 'Sesión' : 'Usuario'}:</strong>{' '}
              {d.tipo === 'sesion' ? (
                d.sesion ? (
                  <Link href={`/clases/${d.objetivo_id}`} className="underline">
                    {d.sesion.titulo} ({d.sesion.ciudad})
                  </Link>
                ) : (
                  'sesión eliminada'
                )
              ) : d.denunciado_username ? (
                <Link href={`/entrenador/${d.denunciado_username}`} className="underline">@{d.denunciado_username}</Link>
              ) : (
                'cuenta eliminada'
              )}
            </p>
            {d.tipo === 'sesion' && d.denunciado_username && (
              <p className="text-sm text-[#6B7355]">Publicada por @{d.denunciado_username}</p>
            )}
            <p className="mt-1 text-sm text-[#1F2400]"><strong>Motivo:</strong> {MOTIVOS[d.motivo] || d.motivo}</p>
            <p className="text-sm text-[#6B7355]">
              Denunciante: {d.denunciante_username ? `@${d.denunciante_username}` : 'cuenta eliminada'}
            </p>
            {d.comentario && (
              <p className="mt-2 whitespace-pre-wrap corte-card border border-[#E2E6CF] bg-[#FBFAF3] p-3 text-sm text-[#1F2400]">{d.comentario}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {['revisada', 'descartada', 'pendiente']
                .filter((estado) => estado !== d.estado)
                .map((estado) => (
                  <button
                    key={estado}
                    type="button"
                    disabled={trabajando === d.id}
                    onClick={() => cambiarEstado(d.id, estado)}
                    className="corte-tag border border-[#E2E6CF] px-3 py-1 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] hover:bg-[#EDF5C9] disabled:opacity-60"
                  >
                    {estado === 'pendiente' ? 'Reabrir' : estado === 'revisada' ? 'Marcar revisada' : 'Descartar'}
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
