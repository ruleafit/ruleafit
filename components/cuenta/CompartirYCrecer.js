'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import CompartirEnlace from '../CompartirEnlace'

// Dirección pública de la web: los enlaces que se comparten no dependen de dónde se abra la sesión.
const BASE = 'https://www.ruleafit.com'

// C25 · «Compartir y crecer»: dos enlaces claramente distintos.
//  A) Invitación personal (conseguir registros y Rulos): /invita/<código>
//  B) Perfil público (que otros te descubran, te sigan y vean tus sesiones): /entrenador/<usuario>, la página pública
//     que ya existía. El enlace de perfil NO concede Rulos.
// Sin historial ni contador de invitados.
export default function CompartirYCrecer({ username }) {
  const [codigo, setCodigo] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    supabase.rpc('mi_codigo_invitacion').then(({ data, error: e }) => {
      if (!vivo) return
      if (e || !data) setError('No hemos podido preparar tu enlace de invitación. Inténtalo de nuevo más tarde.')
      else setCodigo(data)
    })
    return () => {
      vivo = false
    }
  }, [])

  const enlaceInvitacion = codigo ? `${BASE}/invita/${codigo}` : null
  const enlacePerfil = username ? `${BASE}/entrenador/${username}` : null

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="invita-titulo" className="corte-card border border-[#E2E6CF] bg-white p-5">
        <h3 id="invita-titulo" className="text-base font-bold text-[#1F2400]">Invita a tus amigos</h3>
        <p className="mt-1 mb-4 text-sm text-[#6B7355]">
          Invita a alguien a RuleaFit y conseguiréis 20 Rulos cada uno cuando complete su registro.
        </p>
        {enlaceInvitacion ? (
          <CompartirEnlace
            url={enlaceInvitacion}
            etiqueta="Compartir invitación"
            titulo="Te invito a RuleaFit"
            textoMensaje="Únete a RuleaFit con mi invitación y consigue 20 Rulos extra."
          />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-[#6B7355]">Preparando tu enlace…</p>
        )}
      </section>

      <section aria-labelledby="perfil-titulo" className="corte-card border border-[#E2E6CF] bg-white p-5">
        <h3 id="perfil-titulo" className="text-base font-bold text-[#1F2400]">Comparte tu perfil</h3>
        <p className="mt-1 mb-4 text-sm text-[#6B7355]">
          Comparte tu perfil para que otros ruleros te descubran, te sigan y conozcan tus actividades. Cualquiera puede
          abrirlo sin registrarse y verá lo que ya es público: tu usuario, foto, descripción y sesiones activas.
        </p>
        {enlacePerfil ? (
          <CompartirEnlace
            url={enlacePerfil}
            etiqueta="Compartir mi perfil"
            titulo={`@${username} en RuleaFit`}
            textoMensaje={`Mira mi perfil en RuleaFit: @${username}`}
          />
        ) : (
          <p className="text-sm text-[#6B7355]">Cargando tu perfil…</p>
        )}
      </section>
    </div>
  )
}
