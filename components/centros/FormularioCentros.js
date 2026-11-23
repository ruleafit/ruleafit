'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { TIPOS_SOLICITUD, LIMITES, validarSolicitud } from '../../lib/centros/validarSolicitud'

const inputClass =
  'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1F2400] placeholder:text-[#6B7355] transition-colors focus:outline-none focus:ring-2'
const labelClass = 'mb-1 block text-sm font-medium text-[#1F2400]'
const botonClass =
  'flex w-full items-center justify-center gap-2 corte-btn bg-[#B5E600] px-6 py-3 text-base font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2400] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'

const VACIO = { centro: '', ciudad: '', contacto: '', email: '', telefono: '', tipo: '', mensaje: '', privacidad: false }

function Campo({ id, etiqueta, opcional, error, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {etiqueta}
        {opcional && <span className="font-normal text-[#6B7355]"> (Opcional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1 text-sm text-red-600">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function FormularioCentros() {
  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [trampa, setTrampa] = useState('')
  const inicio = useRef(Date.now())

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }
  const claseInput = (campo) =>
    `${inputClass} ${errores[campo] ? 'border-red-500 focus:border-red-500 focus:ring-red-300' : 'border-[#E2E6CF] focus:border-[#B5E600] focus:ring-[#B5E600]'}`

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return // evita el doble envío
    setErrorGeneral('')
    const { errores: errs } = validarSolicitud(datos)
    setErrores(errs)
    if (Object.keys(errs).length > 0) {
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }
    setEnviando(true)
    try {
      const r = await fetch('/api/centros/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, web: trampa, ms: Date.now() - inicio.current }),
      })
      const json = await r.json().catch(() => ({}))
      if (r.ok) {
        setEnviado(true)
      } else {
        if (json.errores) setErrores(json.errores)
        setErrorGeneral(json.error || 'No hemos podido enviar la solicitud. Inténtalo de nuevo.')
      }
    } catch {
      setErrorGeneral('No hemos podido enviar la solicitud. Comprueba tu conexión e inténtalo de nuevo.')
    }
    setEnviando(false) // los datos escritos se conservan si hay error
  }

  if (enviado) {
    return (
      <div role="status" className="rounded-2xl border-2 border-[#B5E600] bg-[#F4FAD8] p-6 text-center sm:p-8">
        <CircleCheck className="mx-auto h-10 w-10 text-[#5E7A00]" aria-hidden="true" />
        <h3 className="mt-3 text-xl font-extrabold text-[#1F2400]">¡Solicitud recibida!</h3>
        <p className="mt-2 text-sm text-[#1F2400] sm:text-base">
          Gracias por tu interés en RuleaFit. Nos pondremos en contacto contigo a través de los datos facilitados.
        </p>
        <p className="mt-5 text-sm font-semibold text-[#1F2400]">¿Quieres empezar ya?</p>
        <Link
          href="/registro?tipo=organizador"
          className="mt-2 inline-flex h-12 items-center justify-center corte-btn bg-[#B5E600] px-8 text-base font-bold text-[#1F2400] transition-colors hover:bg-[#a3d100]"
        >
          Crear cuenta
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-2xl border border-[#E2E6CF] bg-white p-5 text-left shadow-sm sm:p-8">
      {/* Campo trampa: invisible para personas, lo rellenan los robots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="web-centro">No rellenar</label>
        <input id="web-centro" type="text" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
      </div>

      <Campo id="centro" etiqueta="Nombre del centro" error={errores.centro}>
        <input id="centro" type="text" required maxLength={LIMITES.centro} autoComplete="organization" value={datos.centro} onChange={(e) => cambiar('centro', e.target.value)} className={claseInput('centro')} aria-invalid={!!errores.centro} aria-describedby={errores.centro ? 'centro-error' : undefined} />
      </Campo>
      <Campo id="ciudad" etiqueta="Ciudad o municipio" error={errores.ciudad}>
        <input id="ciudad" type="text" required maxLength={LIMITES.ciudad} autoComplete="address-level2" value={datos.ciudad} onChange={(e) => cambiar('ciudad', e.target.value)} className={claseInput('ciudad')} aria-invalid={!!errores.ciudad} aria-describedby={errores.ciudad ? 'ciudad-error' : undefined} />
      </Campo>
      <Campo id="contacto" etiqueta="Nombre de la persona de contacto" error={errores.contacto}>
        <input id="contacto" type="text" required maxLength={LIMITES.contacto} autoComplete="name" value={datos.contacto} onChange={(e) => cambiar('contacto', e.target.value)} className={claseInput('contacto')} aria-invalid={!!errores.contacto} aria-describedby={errores.contacto ? 'contacto-error' : undefined} />
      </Campo>
      <Campo id="email" etiqueta="Correo electrónico" error={errores.email}>
        <input id="email" type="email" required maxLength={LIMITES.email} autoComplete="email" value={datos.email} onChange={(e) => cambiar('email', e.target.value)} className={claseInput('email')} aria-invalid={!!errores.email} aria-describedby={errores.email ? 'email-error' : undefined} />
      </Campo>
      <Campo id="telefono" etiqueta="Teléfono" opcional error={errores.telefono}>
        <input id="telefono" type="tel" maxLength={LIMITES.telefono} autoComplete="tel" value={datos.telefono} onChange={(e) => cambiar('telefono', e.target.value)} className={claseInput('telefono')} aria-invalid={!!errores.telefono} aria-describedby={errores.telefono ? 'telefono-error' : undefined} />
      </Campo>
      <Campo id="tipo" etiqueta="¿Qué necesitas?" error={errores.tipo}>
        <select id="tipo" required value={datos.tipo} onChange={(e) => cambiar('tipo', e.target.value)} className={claseInput('tipo')} aria-invalid={!!errores.tipo} aria-describedby={errores.tipo ? 'tipo-error' : undefined}>
          <option value="">Elige una opción</option>
          {Object.entries(TIPOS_SOLICITUD).map(([valor, texto]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
      </Campo>
      <Campo id="mensaje" etiqueta="Mensaje" opcional error={errores.mensaje}>
        <textarea id="mensaje" rows={4} maxLength={LIMITES.mensaje} value={datos.mensaje} onChange={(e) => cambiar('mensaje', e.target.value)} className={claseInput('mensaje')} aria-invalid={!!errores.mensaje} aria-describedby={errores.mensaje ? 'mensaje-error' : undefined} />
      </Campo>

      <div>
        <label className="flex items-start gap-2 text-sm text-[#1F2400]">
          <input type="checkbox" checked={datos.privacidad} onChange={(e) => cambiar('privacidad', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5E7A00]" aria-invalid={!!errores.privacidad} aria-describedby={errores.privacidad ? 'privacidad-error' : undefined} />
          <span>
            He leído y acepto la{' '}
            <Link href="/privacidad" target="_blank" className="font-semibold underline underline-offset-2 hover:text-[#5E7A00]">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {errores.privacidad && (
          <p id="privacidad-error" className="mt-1 flex items-start gap-1 text-sm text-red-600">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {errores.privacidad}
          </p>
        )}
      </div>

      {errorGeneral && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {errorGeneral}
        </p>
      )}

      <button type="submit" disabled={enviando} className={botonClass}>
        {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
