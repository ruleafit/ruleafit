'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ACEPTA_ARCHIVOS, validarArchivo } from '../../lib/verificaciones/reglas'
import { cifValido } from '../../lib/verificaciones/documentos'
import EstadoSolicitud from './EstadoSolicitud'
import { campoClass, etiquetaClass, botonClass, enlaceClass } from './estilos'

export default function VerificacionCentro({ centro, fiscal, onEnviar, onRetirar }) {
  const sociedad = fiscal?.tipo === 'sociedad' ? fiscal : null
  const [razonSocial, setRazonSocial] = useState(sociedad?.nombre_fiscal || '')
  const [cif, setCif] = useState(sociedad?.nif || '')
  const [archivo, setArchivo] = useState(null)
  const [manual, setManual] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const viva = centro && ['pendiente', 'aprobada'].includes(centro.estado)

  async function enviar(evento) {
    evento.preventDefault()
    const fallo =
      (razonSocial.trim().length < 2 ? 'Escribe la razón social del centro.' : '') ||
      (cifValido(cif) ? '' : 'El CIF no es correcto.') ||
      validarArchivo(archivo) ||
      (acepta ? '' : 'Tienes que aceptar el tratamiento del documento.')
    if (fallo) return setError(fallo)
    setError('')
    setResultado(null)
    setEnviando(true)
    try {
      setResultado(await onEnviar({ razonSocial, cif, archivo, manual }))
      setArchivo(null)
      setAcepta(false)
    } catch (e) {
      setError(e.message)
    }
    setEnviando(false)
  }

  async function retirar() {
    if (!window.confirm('¿Quitar la verificación del centro?')) return
    try {
      setResultado(null)
      await onRetirar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="mt-8 border-t border-[#E2E6CF] pt-6">
      <h3 className="text-base font-bold text-[#1F2400]">Centro verificado</h3>
      <p className="mt-1 text-sm text-[#6B7355]">
        Para gimnasios y centros con CIF. Se mostrará la insignia y la razón social; el documento nunca se enseña.
      </p>

      <EstadoSolicitud solicitud={centro} resultado={resultado} />

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      {viva ? (
        <>
          <p className="mt-2 text-sm text-[#1F2400]">{centro.razon_social} · {centro.cif}</p>
          <button type="button" onClick={retirar} className={`mt-3 ${enlaceClass}`}>
            {centro.estado === 'aprobada' ? 'Quitar la verificación' : 'Retirar la solicitud'}
          </button>
        </>
      ) : (
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
          <label>
            <span className={etiquetaClass}>Razón social</span>
            <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} maxLength={200} className={campoClass} />
          </label>
          <label>
            <span className={etiquetaClass}>CIF</span>
            <input value={cif} onChange={(e) => setCif(e.target.value)} maxLength={15} autoComplete="off" className={campoClass} />
          </label>
          <label>
            <span className={etiquetaClass}>Certificado censal o tarjeta del CIF (mejor el PDF original de Hacienda)</span>
            <input type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setArchivo(e.target.files?.[0] || null)} className={campoClass} />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            Prefiero que lo revise una persona (tarda más).
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            <span>
              Declaro que represento a este centro y consiento que RuleaFit compruebe el documento, según la{' '}
              <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.
            </span>
          </label>
          <button type="submit" disabled={enviando} className={botonClass}>
            {enviando ? 'Comprobando… puede tardar un poco' : 'Verificar centro'}
          </button>
        </form>
      )}
    </div>
  )
}
