'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, GraduationCap, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { AVISO_LEGAL_TITULACIONES } from '../../lib/verificaciones/reglas'
import VisorDocumento from './VisorDocumento'

const insigniaClass =
  'inline-flex items-center gap-1.5 corte-tag border border-[#B5E600] bg-[#EDF5C9] px-3 py-1 text-xs font-bold text-[#3D4A00]'

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
        .select('identidad_verificada, titulacion_acreditada')
        .eq('id', usuarioId)
        .maybeSingle()
      if (error || !perfil) return
      let titulos = []
      if (perfil.titulacion_acreditada) {
        const { data } = await supabase.rpc('titulaciones_publicas', { p_usuario: usuarioId })
        titulos = data || []
      }
      if (!cancelado) setDatos({ usuarioId, ...perfil, titulos })
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [usuarioId, usuarioActual?.id])

  if (!datos || datos.usuarioId !== usuarioId) return null
  if (!datos.identidad_verificada && !datos.titulacion_acreditada) return null

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {datos.identidad_verificada && (
          <span className={insigniaClass} title="RuleaFit ha revisado un documento de identidad de esta persona">
            <BadgeCheck className="h-4 w-4" strokeWidth={2} />
            Identidad verificada
          </span>
        )}
        {datos.titulacion_acreditada && (
          <span className={insigniaClass}>
            <GraduationCap className="h-4 w-4" strokeWidth={2} />
            Titulación acreditada
          </span>
        )}
      </div>

      {datos.titulos.length > 0 && (
        <div className="mt-4 text-left">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7355]">Titulaciones verificadas</h3>
          <ul className="flex flex-col gap-2">
            {datos.titulos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 corte-card border border-[#E2E6CF] bg-white p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1F2400]">{t.nombre}</p>
                  <p className="text-xs text-[#6B7355]">{t.entidad} · {t.anio}</p>
                </div>
                {usuarioActual ? (
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
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-[#6B7355]">{AVISO_LEGAL_TITULACIONES}</p>
        </div>
      )}

      {abierta && <VisorDocumento titulacion={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  )
}
