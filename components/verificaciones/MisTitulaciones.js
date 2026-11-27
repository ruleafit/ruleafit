'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ESTADOS,
  ACEPTA_ARCHIVOS,
  AVISO_TAPAR_DNI,
  MAX_TITULACIONES,
  ANIO_MINIMO,
  validarArchivo,
  validarTitulacion,
} from '../../lib/verificaciones/reglas'
import { campoClass, etiquetaClass, botonClass, enlaceClass, COLOR_ESTADO } from './estilos'

const VACIO = { nombre: '', entidad: '', anio: '' }

export default function MisTitulaciones({ titulaciones, onEnviar, onRetirar }) {
  const [campos, setCampos] = useState(VACIO)
  const [archivo, setArchivo] = useState(null)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [reinicio, setReinicio] = useState(0)

  const vivas = titulaciones.filter((t) => ['pendiente', 'aprobada'].includes(t.estado)).length
  const cambiar = (campo) => (e) => setCampos((prev) => ({ ...prev, [campo]: e.target.value }))

  async function enviar(evento) {
    evento.preventDefault()
    const fallo =
      validarTitulacion(campos) ||
      validarArchivo(archivo) ||
      (acepta ? '' : 'Tienes que aceptar las condiciones del documento.')
    if (fallo) return setError(fallo)
    setError('')
    setEnviando(true)
    try {
      await onEnviar({ ...campos, archivo })
      setCampos(VACIO)
      setArchivo(null)
      setAcepta(false)
      setReinicio((n) => n + 1)
    } catch (e) {
      setError(e.message)
    }
    setEnviando(false)
  }

  async function retirar(t) {
    if (!window.confirm(`¿Eliminar «${t.nombre}»? Se borrará también el documento.`)) return
    try {
      await onRetirar(t.id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="mt-8 border-t border-[#E2E6CF] pt-6">
      <h3 className="text-base font-bold text-[#1F2400]">Titulaciones deportivas</h3>
      <p className="mt-1 text-sm text-[#6B7355]">
        Al subirlas aparecen en tu perfil y en tus sesiones como «Titulación declarada», sin el documento. Cuando las
        revisemos pasan a «Titulación acreditada» y los usuarios con sesión iniciada podrán ver el documento con una marca
        de agua.
      </p>

      {titulaciones.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {titulaciones.map((t) => (
            <li key={t.id} className="corte-card border border-[#E2E6CF] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#1F2400]">{t.nombre}</p>
                <span className={`corte-tag border px-2.5 py-0.5 text-xs font-bold ${COLOR_ESTADO[t.estado]}`}>{t.estado === 'pendiente' ? 'Declarada · en revisión' : ESTADOS[t.estado]}</span>
              </div>
              <p className="text-xs text-[#6B7355]">{t.entidad} · {t.anio}</p>
              {t.motivo && <p className="mt-1 text-sm text-red-700">Motivo: {t.motivo}</p>}
              <button type="button" onClick={() => retirar(t)} className={`mt-2 ${enlaceClass}`}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      {vivas >= MAX_TITULACIONES ? (
        <p className="mt-3 text-sm text-[#6B7355]">Has llegado al máximo de {MAX_TITULACIONES} titulaciones.</p>
      ) : (
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
          <label>
            <span className={etiquetaClass}>Nombre del título</span>
            <input value={campos.nombre} onChange={cambiar('nombre')} maxLength={150} placeholder="Ej. TSEAS, Grado en Ciencias de la Actividad Física y del Deporte" className={campoClass} />
          </label>
          <label>
            <span className={etiquetaClass}>Entidad emisora</span>
            <input value={campos.entidad} onChange={cambiar('entidad')} maxLength={150} placeholder="Universidad, instituto, federación…" className={campoClass} />
          </label>
          <label>
            <span className={etiquetaClass}>Año</span>
            <input type="number" inputMode="numeric" min={ANIO_MINIMO} max={new Date().getFullYear()} value={campos.anio} onChange={cambiar('anio')} className={campoClass} />
          </label>
          <p role="note" className="corte-tag border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{AVISO_TAPAR_DNI}</p>
          <label>
            <span className={etiquetaClass}>Documento (PDF o imagen, máximo 8 MB y 10 páginas)</span>
            <input key={reinicio} type="file" accept={ACEPTA_ARCHIVOS} onChange={(e) => setArchivo(e.target.files?.[0] || null)} className={campoClass} />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#1F2400]">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1 accent-[#B5E600]" />
            <span>
              Declaro que el documento es auténtico y mío y que he tapado mi número de DNI. Consiento que los datos del título
              se muestren desde ahora como declarados y el documento a otros usuarios tras la revisión, según la <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.
            </span>
          </label>
          <button type="submit" disabled={enviando} className={botonClass}>
            {enviando ? 'Enviando…' : 'Añadir titulación'}
          </button>
        </form>
      )}
    </div>
  )
}
