'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const LIMITE_PALABRAS_OPINION = 100
const LIMITE_CARACTERES_OPINION = 750

function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

// valoracionInicial = { id, estrellas, opinion } si ya valoró a este rulero.
// onGuardada recarga la media y el total de valoraciones.
export default function FormularioValoracion({ perfil, usuarioActual, valoracionInicial, onGuardada }) {
  const [valoracionId, setValoracionId] = useState(valoracionInicial?.id ?? null)
  const [estrellasSeleccionadas, setEstrellasSeleccionadas] = useState(valoracionInicial?.estrellas ?? 0)
  const [estrellasHover, setEstrellasHover] = useState(0)
  const [opinionTexto, setOpinionTexto] = useState(valoracionInicial?.opinion || '')
  const [guardandoValoracion, setGuardandoValoracion] = useState(false)
  const [errorValoracion, setErrorValoracion] = useState('')
  const [confirmacionValoracion, setConfirmacionValoracion] = useState('')

  const palabrasOpinion = contarPalabras(opinionTexto)

  async function enviarValoracion(e) {
    e.preventDefault()
    setErrorValoracion('')
    setConfirmacionValoracion('')

    if (estrellasSeleccionadas < 1 || estrellasSeleccionadas > 5) {
      setErrorValoracion('Elige de 1 a 5 estrellas.')
      return
    }

    if (contarPalabras(opinionTexto) > LIMITE_PALABRAS_OPINION) {
      setErrorValoracion(`La opinión no puede superar ${LIMITE_PALABRAS_OPINION} palabras.`)
      return
    }

    setGuardandoValoracion(true)

    const editando = Boolean(valoracionId)

    const { data, error } = await supabase
      .from('valoraciones')
      .upsert(
        {
          cliente_id: usuarioActual.id,
          entrenador_id: perfil.id,
          estrellas: estrellasSeleccionadas,
          opinion: opinionTexto.trim() || null,
        },
        { onConflict: 'cliente_id,entrenador_id' }
      )
      .select('id, estrellas, opinion')
      .single()

    setGuardandoValoracion(false)

    if (error) {
      setErrorValoracion('No hemos podido guardar tu valoración. Inténtalo de nuevo.')
      return
    }

    setValoracionId(data.id)
    setConfirmacionValoracion(editando ? 'Valoración actualizada.' : '¡Gracias por tu valoración!')
    setTimeout(() => setConfirmacionValoracion(''), 5000)

    await onGuardada()
  }

  return (
    <form onSubmit={enviarValoracion} className="mt-6 border-t border-[#E2E6CF] pt-6">
      <p className="mb-2 text-sm font-semibold text-[#1F2400]">
        {valoracionId ? 'Edita tu valoración' : 'Valora a este rulero'}
      </p>

      <div className="mb-4 flex gap-1">
        {[1, 2, 3, 4, 5].map((numero) => (
          <button
            key={numero}
            type="button"
            onClick={() => setEstrellasSeleccionadas(numero)}
            onMouseEnter={() => setEstrellasHover(numero)}
            onMouseLeave={() => setEstrellasHover(0)}
            className="p-0.5"
            aria-label={`${numero} estrella${numero === 1 ? '' : 's'}`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                numero <= (estrellasHover || estrellasSeleccionadas)
                  ? 'text-[#B5E600]'
                  : 'text-[#E2E6CF]'
              }`}
              fill={numero <= (estrellasHover || estrellasSeleccionadas) ? 'currentColor' : 'none'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <textarea
        value={opinionTexto}
        onChange={(e) => {
          setOpinionTexto(e.target.value.slice(0, LIMITE_CARACTERES_OPINION))
          if (errorValoracion) setErrorValoracion('')
        }}
        maxLength={LIMITE_CARACTERES_OPINION}
        rows={3}
        placeholder="Cuenta tu experiencia (opcional)"
        className="block w-full corte-btn border border-[#E2E6CF] px-4 py-2 text-sm text-[#1F2400] transition-colors focus:border-[#B5E600] focus:outline-none focus:ring-2 focus:ring-[#B5E600]"
      />
      <p
        className={`mt-1 text-right text-xs ${
          palabrasOpinion > LIMITE_PALABRAS_OPINION ? 'font-semibold text-red-600' : 'text-[#6B7355]'
        }`}
      >
        {palabrasOpinion}/{LIMITE_PALABRAS_OPINION} palabras
      </p>

      {errorValoracion && <p className="mb-3 text-xs text-red-600">{errorValoracion}</p>}
      {confirmacionValoracion && (
        <p className="mb-3 text-sm font-medium text-[#3D4A00]">{confirmacionValoracion}</p>
      )}

      <button
        type="submit"
        disabled={guardandoValoracion || estrellasSeleccionadas === 0}
        className="corte-btn bg-[#B5E600] px-6 py-2 text-sm font-bold text-[#1F2400] transition hover:bg-[#a3d100] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {guardandoValoracion
          ? 'Guardando...'
          : valoracionId
            ? 'Actualizar valoración'
            : 'Enviar valoración'}
      </button>
    </form>
  )
}
