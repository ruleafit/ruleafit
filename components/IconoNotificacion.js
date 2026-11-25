import { Star, Megaphone, Bell, Gift } from 'lucide-react'

// Icono por tipo de notificación (solo las nuevas de C16 y C18; el resto sigue sin icono, como siempre).
export function IconoNotificacion({ tipo }) {
  if (tipo === 'solicitud_valoracion') return <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#B5E600]" fill="#B5E600" strokeWidth={1.5} aria-hidden="true" />
  if (tipo === 'aviso_organizador') return <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} aria-hidden="true" />
  if (tipo === 'invitacion_recompensa') return <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} aria-hidden="true" />
  if (tipo === 'plaza_libre') return <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#3D4A00]" strokeWidth={2} aria-hidden="true" />
  return null
}

// Acción breve bajo el mensaje (la notificación entera abre el destino).
export function AccionNotificacion({ tipo }) {
  if (tipo === 'solicitud_valoracion') {
    return <span className="mt-0.5 inline-flex w-fit items-center gap-1 corte-tag bg-[#EDF5C9] px-2 py-0.5 text-[11px] font-semibold text-[#3D4A00]">Valorar experiencia</span>
  }
  if (tipo === 'plaza_libre') {
    return <span className="mt-0.5 inline-flex w-fit items-center gap-1 corte-tag bg-[#EDF5C9] px-2 py-0.5 text-[11px] font-semibold text-[#3D4A00]">Ver sesión</span>
  }
  return null
}
