'use client'

import { useState } from 'react'

const input =
  'block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]'
const etiqueta = 'mb-1 block text-sm font-medium text-[#1F2400]'
const VACIO = { pedido: '', importe: '', referencia: '', fechaLimite: '', motivo: '' }

export default function FormularioContracargo({ onCambiar }) {
  const [f, setF] = useState(VACIO)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const cambia = (campo) => (e) => setF((antes) => ({ ...antes, [campo]: e.target.value }))

  async function enviar(e) {
    e.preventDefault()
    setTrabajando(true)
    setMensaje('')
    const fallo = await onCambiar({ accion: 'registrar', ...f })
    setTrabajando(false)
    if (fallo) setMensaje(fallo)
    else setF(VACIO)
  }

  const campos = [
    ['pedido', 'Número de pedido', { required: true, maxLength: 12 }],
    ['importe', 'Importe en euros (vacío = todo)', { inputMode: 'decimal', placeholder: '12,50' }],
    ['referencia', 'Referencia del banco', { maxLength: 100 }],
    ['fechaLimite', 'Fecha límite para responder', { type: 'date' }],
  ]

  return (
    <form onSubmit={enviar} className="mt-6 corte-card border border-[#E2E6CF] bg-white p-4">
      <h2 className="text-base font-bold text-[#1F2400]">Anotar un contracargo</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {campos.map(([campo, texto, extra]) => (
          <div key={campo}>
            <label className={etiqueta} htmlFor={`cc-${campo}`}>{texto}</label>
            <input id={`cc-${campo}`} className={input} value={f[campo]} onChange={cambia(campo)} autoComplete="off" {...extra} />
          </div>
        ))}
      </div>
      <label className={`${etiqueta} mt-3`} htmlFor="cc-motivo">Motivo que indica el banco</label>
      <textarea id="cc-motivo" className={input} rows={2} maxLength={500} value={f.motivo} onChange={cambia('motivo')} />
      <button
        type="submit"
        disabled={trabajando}
        className="mt-3 corte-btn bg-[#B5E600] px-5 py-2 text-sm font-bold text-[#1F2400] disabled:opacity-60"
      >
        {trabajando ? 'Guardando...' : 'Anotar y retener'}
      </button>
      {mensaje && <p role="alert" className="mt-2 text-sm text-red-600">{mensaje}</p>}
    </form>
  )
}
