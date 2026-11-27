'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, GraduationCap, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { AVISO_LEGAL_TITULACIONES, AVISO_DECLARADA } from '../../lib/verificaciones/reglas'
import BotonDenunciar from '../BotonDenunciar'
import VisorDocumento from './VisorDocumento'

const insigniaClass =
  'inline-flex items-center gap-1.5 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-1 text-xs font-bold text-[#3D4A00]'
const declaradaClass =
  'inline-flex items-center gap-1.5 corte-tag border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600'

// Insignias y titulaciones verificadas de un organizador (perfil y ficha de
// sesión). Hace sus propias consultas: si fallan (por ejemplo, sql/110 todavía
// sin aplicar) no pinta nada y la página sigue funcionando.
export default function VerificacionPublica({ usuarioId, usuarioActual, className = '' }) {
  const [datos, setDatos] = useState(null)
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    if (!usuarioId) return
    let cancelado = false
    async function cargar() {
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('identidad_verificada')
        .eq('id', usuarioId)
        .maybeSingle()
      if (error || !perfil) return
      // Declaradas (sin revisar) y acreditadas (sql/111).
      const { data: titulos } = await supabase.rpc('titulaciones_visibles', { p_usuario: usuarioId })
      if (!cancelado) setDatos({ usuarioId, ...perfil, titulos: titulos || [] })
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuarioId, usuarioActual?.id])

  if (!datos || datos.usuarioId !== usuarioId) return null
  const acreditada = datos.titulos.some((t) => t.estado === 'aprobada')
  const declarada = datos.titulos.some((t) => t.estado === 'pendiente')
  if (!datos.identidad_verificada && !datos.titulos.length) return null

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {datos.identidad_verificada && (
          <span className={insigniaClass} title="RuleaFit ha revisado un documento de identidad de esta persona">
            <BadgeCheck className="h-4 w-4" strokeWidth={2} />
            Identidad verificada
          </span>
        )}
        {datos.titulos.length > 0 &&
          (acreditada ? (
            <span className={insigniaClass}>
              <GraduationCap className="h-4 w-4" strokeWidth={2} />
              Titulación acreditada
            </span>
          ) : (
            <span className={declaradaClass} title={AVISO_DECLARADA}>
              <GraduationCap className="h-4 w-4" strokeWidth={2} />
              Titulación declarada
            </span>
          ))}
      </div>

      {datos.titulos.length > 0 && (
        <div className="mt-4 text-left">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Titulaciones</h3>
          <ul className="flex flex-col gap-2">
            {datos.titulos.map((t) => {
              const revisada = t.estado === 'aprobada'
              return (
                <li key={t.id} className="corte-card border border-[#E2E6CF] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1F2400]">{t.nombre}</p>
                      <p className="text-xs text-[#6B7355]">{t.entidad} · {t.anio}</p>
                    </div>
                    <span className={revisada ? insigniaClass : declaradaClass}>{revisada ? 'Acreditada' : 'Declarada'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {!revisada ? (
                      <span className="text-xs text-[#6B7355]">Pendiente de revisión: documento no disponible.</span>
                    ) : usuarioActual ? (
                      <button
                        type="button"
                        onClick={() => setAbierta(t)}
                        className="inline-flex items-center gap-1.5 corte-btn border border-[#E2E6CF] px-3 py-1.5 text-xs font-semibold text-[#3D4A00] hover:border-[#B5E600]"
                      >
                        <Eye className="h-4 w-4" strokeWidth={2} />
                        Ver documento
                      </button>
                    ) : (
                      <Link href="/login" className="text-xs font-semibold text-[#3D4A00] underline">
                        Inicia sesión para ver el documento
                      </Link>
                    )}
                    <BotonDenunciar
                      tipo="titulacion"
                      objetivoId={t.id}
                      usuarioDenunciadoId={usuarioId}
                      usuarioActual={usuarioActual}
                      etiqueta="Denunciar titulación"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {declarada && <p className="mt-2 text-xs leading-relaxed text-[#6B7355]">{AVISO_DECLARADA}</p>}
          {acreditada && <p className="mt-2 text-xs leading-relaxed text-[#6B7355]">{AVISO_LEGAL_TITULACIONES}</p>}
        </div>
      )}

      {abierta && <VisorDocumento titulacion={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  )
}
