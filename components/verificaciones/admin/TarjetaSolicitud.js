'use client'

import { useState } from 'react'
import Link from 'next/link'
import { campoClass, etiquetaClass, botonClass, COLOR_ESTADO } from '../estilos'
import { ESTADOS } from '../../../lib/verificaciones/reglas'
import VisorDocumento from '../VisorDocumento'
import { peticionAdmin } from './useColaVerificaciones'

const secundarioClass =
  'corte-tag border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600] disabled:opacity-60'

export default function TarjetaSolicitud({ tipo, solicitud, onResolver }) {
  const [motivo, setMotivo] = useState('')
  const [numero, setNumero] = useState('')
  const [nombreRevisado, setNombreRevisado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [imagenes, setImagenes] = useState({})
  const [viendo, setViendo] = useState(false)
  const esIdentidad = tipo === 'identidad'
  const pendiente = solicitud.estado === 'pendiente'

  async function verCara(cara) {
    setError('')
    const respuesta = await peticionAdmin(`/api/admin/verificaciones/identidad?id=${solicitud.id}&cara=${cara}`)
    const json = await respuesta?.json().catch(() => null)
    if (!respuesta?.ok) return setError(json?.error || 'No se pudo abrir el documento.')
    setImagenes((prev) => ({ ...prev, [cara]: json.url }))
  }

  async function decidir(decision, confirmarDiscrepancia = false) {
    setError('')
    if (decision !== 'aprobar' && !motivo.trim()) return setError('Escribe el motivo.')
    if (decision === 'aprobar' && esIdentidad && solicitud.tiene_fiscal && !nombreRevisado) {
      return setError('Comprueba que el nombre del documento coincide con el nombre fiscal.')
    }
    if (decision === 'revocar' && !window.confirm('¿Retirar la verificación a este usuario?')) return
    setTrabajando(true)
    const r = await onResolver({
      tipo,
      id: solicitud.id,
      decision,
      motivo: motivo.trim() || null,
      numeroDocumento: numero || null,
      confirmarDiscrepancia,
    })
    setTrabajando(false)
    if (r.ok) return
    if (r.requiereConfirmacion && window.confirm(`${r.error} ¿Aprobar de todos modos?`)) {
      return decidir(decision, true)
    }
    setError(r.error || 'No se pudo guardar la decisión.')
  }

  return (
    <li className="corte-card border border-[#E2E6CF] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`corte-tag border px-2.5 py-0.5 text-xs font-bold ${COLOR_ESTADO[solicitud.estado]}`}>{ESTADOS[solicitud.estado]}</span>
        <span className="text-xs text-[#6B7355]">{new Date(solicitud.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
      </div>
      <p className="mt-2 text-sm text-[#1F2400]">
        {solicitud.username ? (
          <Link href={`/entrenador/${solicitud.username}`} className="font-bold underline">@{solicitud.username}</Link>
        ) : (
          'cuenta sin perfil'
        )}
        {' · '}
        {esIdentidad ? solicitud.tipo_documento : `${solicitud.nombre} — ${solicitud.entidad} (${solicitud.anio})`}
      </p>

      {solicitud.denuncias > 0 && (
        <p className="mt-1">
          <Link href="/admin/denuncias" className="text-sm font-semibold text-red-700 underline">
            Denuncias sin revisar: {solicitud.denuncias}
          </Link>
        </p>
      )}

      {esIdentidad && (
        <p className="mt-1 text-sm text-[#6B7355]">
          {solicitud.tiene_fiscal ? `Nombre fiscal: ${solicitud.nombre_fiscal}` : 'Sin perfil fiscal.'}
        </p>
      )}

      {esIdentidad && pendiente && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => verCara('anverso')} className={secundarioClass}>Ver anverso</button>
            {solicitud.tiene_reverso && (
              <button type="button" onClick={() => verCara('reverso')} className={secundarioClass}>Ver reverso</button>
            )}
          </div>
          {Object.entries(imagenes).map(([cara, url]) => (
            <p key={cara} className="mt-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#3D4A00] underline">
                Abrir {cara} (el enlace caduca en 60 segundos)
              </a>
            </p>
          ))}
          {solicitud.tiene_fiscal && (
            <div className="mt-3 flex flex-col gap-3">
              <label>
                <span className={etiquetaClass}>Número del documento (se compara con el NIF y no se guarda)</span>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} autoComplete="off" className={campoClass} />
              </label>
              <label className="flex items-start gap-2 text-sm text-[#1F2400]">
                <input type="checkbox" checked={nombreRevisado} onChange={(e) => setNombreRevisado(e.target.checked)} className="mt-1 accent-[#B5E600]" />
                El nombre del documento coincide con el nombre fiscal.
              </label>
            </div>
          )}
        </>
      )}

      {!esIdentidad && (
        <button type="button" onClick={() => setViendo(true)} className={`mt-3 ${secundarioClass}`}>Ver documento</button>
      )}
      {viendo && <VisorDocumento titulacion={solicitud} onCerrar={() => setViendo(false)} />}

      <label className="mt-3 block">
        <span className={etiquetaClass}>{pendiente ? 'Motivo (obligatorio para rechazar)' : 'Motivo para retirar'}</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} className={campoClass} />
      </label>

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {pendiente ? (
          <>
            <button type="button" disabled={trabajando} onClick={() => decidir('aprobar')} className={botonClass}>Aprobar</button>
            <button type="button" disabled={trabajando} onClick={() => decidir('rechazar')} className={secundarioClass}>Rechazar</button>
          </>
        ) : (
          <button type="button" disabled={trabajando} onClick={() => decidir('revocar')} className={secundarioClass}>Retirar verificación</button>
        )}
      </div>
    </li>
  )
}
