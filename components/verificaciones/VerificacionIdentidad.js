'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TIPOS_DOCUMENTO, ACEPTA_ARCHIVOS, validarArchivo } from '../../lib/verificaciones/reglas'
import { dniNieValido } from '../../lib/verificaciones/documentos'
import EstadoSolicitud from './EstadoSolicitud'
import { campoClass, etiquetaClass, botonClass, enlaceClass } from './estilos'

export default function VerificacionIdentidad({ identidad, fiscal, onEnviar, onRetirar }) {
  const persona = fiscal && fiscal.tipo !== 'sociedad' ? fiscal : null
  const [tipo, setTipo] = useState('DNI')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [anverso, setAnverso] = useState(null)
  const [reverso, setReverso] = useState(null)
  const [manual, setManual] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const viva = identidad && ['pendiente', 'aprobada'].includes(identidad.estado)
  const conReverso = tipo !== 'PASAPORTE'

  async function enviar(evento) {
    evento.preventDefault()
    const datosMal =
      !persona &&
      (nombre.trim().split(/\s+/).length < 2
        ? 'Escribe tu nombre y apellidos como aparecen en el documento.'
        : !numero.trim()
          ? 'Escribe el número del documento.'
          : conReverso && !dniNieValido(numero)
            ? 'El número de DNI/NIE no es correcto.'
            : '')
    const fallo =
      datosMal ||
      validarArchivo(anverso) ||
      (conReverso ? validarArchivo(reverso) : '') ||
      (acepta ? '' : 'Tienes que aceptar el tratamiento del documento.')
    if (fallo) return setError(fallo)
    setError('')
    setResultado(null)
    setEnviando(true)
    try {
      setResultado(await onEnviar({ tipo, anverso, reverso: conReverso ? reverso : null, nombre, numero, manual }))
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
      setResultado(null)
      await onRetirar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 className="text-base font-bold text-[#1F2400]">Identidad verificada</h3>
      <p className="mt-1 text-sm text-[#6B7355]">
        Es opcional. Lo comprobamos al momento; las imágenes nunca las ven otros usuarios y se borran al resolverse.
      </p>

      <EstadoSolicitud solicitud={identidad} resultado={resultado} />

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
          {persona ? (
            <p className="text-sm text-[#6B7355]">
              Se compara con tu perfil fiscal: <strong>{persona.nombre_fiscal}</strong>.
            </p>
          ) : (
            <>
              <label>
                <span className={etiquetaClass}>Nombre y apellidos</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} autoComplete="name" className={campoClass} />
              </label>
              <label>
                <span className={etiquetaClass}>Número del documento (solo para compararlo, no se guarda)</span>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={30} autoComplete="off" className={campoClass} />
              </label>
            </>
          )}
          <label>
            <span className={etiquetaClass}>{conReverso ? 'Anverso' : 'Página de datos'}</span>
            <input type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setAnverso(e.target.files?.[0] || null)} className={campoClass} />
          </label>
          {conReverso && (
            <label>
              <span className={etiquetaClass}>Reverso (con las líneas de letras y &lt;&lt;&lt;)</span>
              <input type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setReverso(e.target.files?.[0] || null)} className={campoClass} />
            </label>
          )}
          <p className="text-xs text-[#6B7355]">Foto recta, con buena luz, sin reflejos y con el documento ocupando casi toda la imagen.</p>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            Prefiero que lo revise una persona (tarda más).
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            <span>
              Consiento que RuleaFit compruebe este documento, de forma automática o manual, solo para verificar mi identidad,
              según la <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.
            </span>
          </label>
          <button type="submit" disabled={enviando} className={botonClass}>
            {enviando ? 'Comprobando… puede tardar un poco' : 'Verificar'}
          </button>
        </form>
      )}
    </div>
  )
}
