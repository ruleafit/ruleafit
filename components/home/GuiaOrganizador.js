'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Circle, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const CLAVE_CERRADA = 'ruleafit_guia_organizador_cerrada'

// Guía de inicio para organizadores (N15). No es un rol ni un flujo aparte: solo se muestra a quien dijo que
// quiere organizar (registro desde /centros) o a quien aún tiene muy pocas sesiones publicadas. Los pasos
// se marcan con datos que ya existen; las consultas extra solo se hacen si la guía va a mostrarse.
export default function GuiaOrganizador({ usuario, misClases }) {
  const [cerrada, setCerrada] = useState(true) // oculta hasta saber si el usuario la cerró
  const [perfilCompleto, setPerfilCompleto] = useState(null)
  const [tieneUbicacion, setTieneUbicacion] = useState(null)

  const publicadas = (misClases || []).length
  const interes =
    usuario?.user_metadata?.interes === 'organizador' ||
    (() => { try { return localStorage.getItem('ruleafit_interes_organizador') === '1' } catch { return false } })()
  const elegible = !!usuario && misClases !== null && (interes || (publicadas >= 1 && publicadas <= 2)) && publicadas < 3

  useEffect(() => {
    try { setCerrada(localStorage.getItem(CLAVE_CERRADA) === '1') } catch { setCerrada(false) }
  }, [])

  useEffect(() => {
    if (!elegible || cerrada) return
    let vivo = true
    ;(async () => {
      const [{ data: perfil }, { count }] = await Promise.all([
        supabase.from('perfiles').select('descripcion, foto_url').eq('id', usuario.id).maybeSingle(),
        supabase.from('ubicaciones_habituales').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),
      ])
      if (!vivo) return
      setPerfilCompleto(!!(perfil?.foto_url && (perfil?.descripcion || '').trim()))
      setTieneUbicacion((count || 0) > 0)
    })()
    return () => { vivo = false }
  }, [elegible, cerrada, usuario?.id])

  if (!elegible || cerrada || perfilCompleto === null) return null

  const pasos = [
    { hecho: perfilCompleto, titulo: 'Completa tu perfil', texto: 'Añade tu foto y una descripción para generar confianza.', href: '/cuenta', accion: 'Ir a Mi cuenta' },
    { hecho: tieneUbicacion, titulo: 'Guarda tu ubicación habitual', texto: 'Guárdala una vez y reutilízala al publicar.', href: '/publicar', accion: 'Ir a Publicar' },
    { hecho: publicadas > 0, titulo: 'Publica tus primeras sesiones', texto: 'Puedes crear una sesión o repetirla cada semana.', href: '/publicar', accion: 'Publicar sesión' },
  ]
  if (pasos.every((p) => p.hecho)) return null

  function cerrar() {
    setCerrada(true)
    try { localStorage.setItem(CLAVE_CERRADA, '1') } catch {}
  }

  return (
    <section aria-label="Guía para empezar a organizar" className="mx-auto mt-6 w-full max-w-3xl px-4">
      <div className="relative rounded-2xl border-2 border-[#B5E600] bg-white p-5 shadow-sm">
        <button type="button" onClick={cerrar} aria-label="Cerrar guía" className="absolute right-3 top-3 rounded-full p-1 text-[#6B7355] hover:bg-[#F4FAD8]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="pr-8 text-lg font-extrabold text-[#1F2400]">Empieza a organizar en 3 pasos</h2>
        <ol className="mt-3 space-y-3">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="flex items-start gap-3">
              {p.hecho ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5E7A00]" aria-label="Completado" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#6B7355]" aria-label="Pendiente" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-semibold ${p.hecho ? 'text-[#6B7355] line-through' : 'text-[#1F2400]'}`}>{i + 1}. {p.titulo}</p>
                {!p.hecho && <p className="text-sm text-[#3d4426]">{p.texto}</p>}
              </div>
              {!p.hecho && (
                <Link href={p.href} className="shrink-0 text-sm font-bold text-[#5E7A00] underline underline-offset-2 hover:text-[#1F2400]">
                  {p.accion}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
