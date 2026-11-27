'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TIPOS_DOCUMENTO, ESTADOS, ACEPTA_ARCHIVOS, validarArchivo } from '../../lib/verificaciones/reglas'
import { campoClass, etiquetaClass, botonClass, enlaceClass, COLOR_ESTADO } from './estilos'

export default function VerificacionIdentidad({ identidad, onEnviar, onRetirar }) {
  const [tipo, setTipo] = useState('DNI')
  const [anverso, setAnverso] = useState(null)
  const [reverso, setReverso] = useState(null)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const viva = identidad && ['pendiente', 'aprobada'].includes(identidad.estado)
  const conReverso = tipo !== 'PASAPORTE'

  async function enviar(evento) {
    evento.preventDefault()
    const fallo =
      validarArchivo(anverso) ||
      (conReverso ? validarArchivo(reverso) : '') ||
      (acepta ? '' : 'Tienes que aceptar el tratamiento del documento.')
    if (fallo) return setError(fallo)
    setError('')
    setEnviando(true)
    try {
      await onEnviar({ tipo, anverso, reverso: conReverso ? reverso : null })
      setAnverso(null)
      setReverso(null)
      setAcepta(false)
    } catch (e) {
      setError(e.message)
    }
    setEnviando(false)
  }

  async function retirar() {
    const texto =
      identidad.estado === 'aprobada'
        ? '¿Quitar la insignia «Identidad verificada»? Para recuperarla tendrás que enviar el documento otra vez.'
        : '¿Retirar la solicitud? Se borrarán las imágenes enviadas.'
    if (!window.confirm(texto)) return
    try {
      await onRetirar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 className="text-base font-bold text-[#1F2400]">Identidad verificada</h3>
      <p className="mt-1 text-sm text-[#6B7355]">
        Demuestra que eres una persona real. Las imágenes solo las ve el equipo de RuleaFit y se borran al revisarlas.
      </p>

      {identidad && (
        <p className="mt-3">
          <span className={`inline-block corte-tag border px-3 py-1 text-xs font-bold ${COLOR_ESTADO[identidad.estado]}`}>
            {ESTADOS[identidad.estado]}
          </span>
          {identidad.motivo && <span className="mt-2 block text-sm text-red-700">Motivo: {identidad.motivo}</span>}
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      {viva ? (
        <button type="button" onClick={retirar} className={`mt-3 ${enlaceClass}`}>
          {identidad.estado === 'aprobada' ? 'Quitar la verificación' : 'Retirar la solicitud'}
        </button>
      ) : (
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
          <label>
            <span className={etiquetaClass}>Documento</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campoClass}>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.valor} value={t.valor}>{t.nombre}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiquetaClass}>{conReverso ? 'Anverso' : 'Página de datos'}</span>
            <input type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setAnverso(e.target.files?.[0] || null)} className={campoClass} />
          </label>
          {conReverso && (
            <label>
              <span className={etiquetaClass}>Reverso</span>
              <input type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setReverso(e.target.files?.[0] || null)} className={campoClass} />
            </label>
          )}
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            <span>
              Consiento que RuleaFit revise este documento solo para verificar mi identidad, según la{' '}
              <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>. Las imágenes se
              eliminan al aprobar o rechazar la solicitud.
            </span>
          </label>
          <button type="submit" disabled={enviando} className={botonClass}>
            {enviando ? 'Enviando…' : 'Enviar para revisión'}
          </button>
        </form>
      )}
    </div>
  )
}
