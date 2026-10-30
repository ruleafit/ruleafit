'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Flag, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const MOTIVOS = [
  ['contenido_inapropiado', 'Contenido inapropiado u ofensivo'],
  ['estafa', 'Estafa o engaño'],
  ['suplantacion', 'Suplantación de identidad'],
  ['acoso', 'Acoso o comportamiento abusivo'],
  ['peligro', 'Peligro para la seguridad'],
  ['otro', 'Otro motivo'],
]

// Denunciar una sesión (tipo "sesion") o a un usuario (tipo "usuario"). Lo
// piden las tiendas de aplicaciones para el contenido generado por usuarios.
// Las denuncias se guardan en public.denuncias (sql/068) y las revisa el
// administrador desde el panel de Supabase.
export default function BotonDenunciar({
  tipo,
  objetivoId,
  usuarioDenunciadoId,
  usuarioActual,
  etiqueta = 'Denunciar',
  className = '',
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState(MOTIVOS[0][0])
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null) // { ok: boolean, texto: string }

  const claseBoton =
    className ||
    'inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7355] underline-offset-2 hover:text-[#1F2400] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5E600]'

  // Sin sesión se envía a iniciar sesión; no se denuncia a uno mismo.
  if (!usuarioActual) {
    return (
      <Link href="/login" className={claseBoton}>
        <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
        {etiqueta}
      </Link>
    )
  }
  if (usuarioDenunciadoId && usuarioDenunciadoId === usuarioActual.id) return null

  function cerrar() {
    setAbierto(false)
    setResultado(null)
    setComentario('')
    setMotivo(MOTIVOS[0][0])
  }

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setResultado(null)

    const { error } = await supabase.from('denuncias').insert({
      denunciante_id: usuarioActual.id,
      tipo,
      objetivo_id: objetivoId,
      usuario_denunciado_id: usuarioDenunciadoId || null,
      motivo,
      comentario: comentario.trim() || null,
    })

    setEnviando(false)

    if (!error) {
      setResultado({ ok: true, texto: 'Gracias. Hemos recibido tu denuncia y la revisaremos.' })
    } else if (error.code === '23505') {
      setResultado({ ok: true, texto: 'Ya nos avisaste de esto. Lo estamos revisando.' })
    } else {
      setResultado({ ok: false, texto: 'No se pudo enviar la denuncia. Inténtalo de nuevo más tarde.' })
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={claseBoton}>
        <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
        {etiqueta}
      </button>

      {abierto &&
        createPortal(
          <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={cerrar}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Denunciar"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto corte-card bg-[#FBFAF3] p-5 shadow-xl sm:p-6"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-lg font-extrabold text-[#1F2400]">
                  {tipo === 'usuario' ? 'Denunciar usuario' : 'Denunciar sesión'}
                </h2>
                <button type="button" onClick={cerrar} aria-label="Cerrar" className="shrink-0 text-[#6B7355] hover:text-[#1F2400]">
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {resultado?.ok ? (
                <div>
                  <p className="text-sm text-[#3D4A00]">{resultado.texto}</p>
                  <button
                    type="button"
                    onClick={cerrar}
                    className="mt-4 inline-flex h-10 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100]"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={enviar} className="flex flex-col gap-3">
                  <p className="text-sm text-[#6B7355]">
                    Cuéntanos qué ocurre. Revisaremos la denuncia y actuaremos si incumple las normas.
                  </p>
                  <div>
                    <label htmlFor="motivo-denuncia" className="mb-1 block text-sm font-medium text-[#1F2400]">
                      Motivo
                    </label>
                    <select
                      id="motivo-denuncia"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
                    >
                      {MOTIVOS.map(([valor, texto]) => (
                        <option key={valor} value={valor}>{texto}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="comentario-denuncia" className="mb-1 block text-sm font-medium text-[#1F2400]">
                      Detalles (opcional)
                    </label>
                    <textarea
                      id="comentario-denuncia"
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value.slice(0, 1000))}
                      rows={4}
                      className="block w-full rounded-lg border border-[#E2E6CF] bg-white px-3 py-2 text-sm text-[#1F2400] focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
                    />
                    <p className="mt-1 text-xs text-[#6B7355]">{comentario.length}/1000</p>
                  </div>
                  {resultado && !resultado.ok && <p className="text-sm text-red-700">{resultado.texto}</p>}
                  <button
                    type="submit"
                    disabled={enviando}
                    className="inline-flex h-11 items-center justify-center corte-btn bg-[#B5E600] px-6 text-sm font-bold text-[#1F2400] hover:bg-[#a3d100] disabled:opacity-60"
                  >
                    {enviando ? 'Enviando…' : 'Enviar denuncia'}
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
