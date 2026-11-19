import {
  Dumbbell,
  ClipboardList,
  CircleUserRound,
  CalendarCheck,
  Wallet,
  UserRoundSearch,
  Clock,
  CalendarClock,
  Tag,
  Whistle,
} from 'lucide-react'

// Tarjetas únicas para cualquier usuario logueado (Fase 3 de la unificación
// de roles, 11 sept 2026; retocado el mismo día a partir del feedback del
// usuario sobre la primera versión). "variante" diferencia los tres grupos
// que pidió el usuario: los dos enfocados a participar en sesiones
// ("participante"), los dos enfocados a organizarlas ("organizador"), y los
// dos que sirven para ambas cosas por igual ("ambos"). Ver
// estiloTarjetaAcceso más abajo para los colores de cada uno.
export const ACCESOS = [
  { href: '/clases', label: 'Explora y reserva', Icono: Dumbbell, variante: 'participante' },
  { href: '/mis-reservas', label: 'Mis reservas', Icono: CalendarCheck, variante: 'participante' },
  { href: '/mis-clases', label: 'Mis sesiones publicadas', Icono: ClipboardList, variante: 'organizador' },
  { href: '/publicar', label: 'Publicar sesión', Icono: Whistle, variante: 'organizador' },
  { href: '/entrenadores', label: 'Ruleros', Icono: UserRoundSearch, variante: 'ambos' },
  { href: '/cuenta', label: 'Mi cuenta', Icono: CircleUserRound, variante: 'ambos' },
]

// Mismo criterio de color en toda la portada y en components/Menu.js:
// blanco con borde = participante, verde lima = organizador, fondo oscuro
// con icono lima = ambos (mismo estilo que ya usaba el bloque de captación
// "¿Eres entrenador?" más abajo, para que no sea un color inventado).
export function estiloTarjetaAcceso(variante) {
  if (variante === 'organizador') {
    return { tarjeta: 'border-[#B5E600] bg-[#B5E600]', icono: 'text-white', texto: 'text-[#1F2400]' }
  }
  if (variante === 'ambos') {
    return { tarjeta: 'border-[#1F2400] bg-[#1F2400]', icono: 'text-[#B5E600]', texto: 'text-white' }
  }
  return { tarjeta: 'border-2 border-[#1F2400]/15 bg-white/95', icono: 'text-[#B5E600]', texto: 'text-[#1F2400]' }
}

export const CATEGORIAS = [
  { nombre: 'Fuerza / funcional', imagen: '/imagenes/fuerza.jpg' },
  { nombre: 'Cardio', imagen: '/imagenes/running.jpg' },
  { nombre: 'Yoga / Pilates / movilidad', imagen: '/imagenes/yoga.jpg' },
  { nombre: 'Otros', imagen: '/imagenes/combate.jpg' },
]

// Unificados en una sola lista (Fase 3): antes eran dos ternas alternativas
// según rol ("como participante" / "como organizador"), ahora se muestran
// las seis juntas porque cualquiera puede ser ambas cosas.
export const PUNTOS = [
  { texto: 'Sin cuota mensual', Icono: Wallet },
  { texto: 'Elige tu entrenador', Icono: UserRoundSearch },
  { texto: 'Cancela hasta 2 h antes', Icono: Clock },
  { texto: 'Tu horario, tus normas', Icono: CalendarClock },
  { texto: 'Tú fijas el precio y las plazas', Icono: Tag },
  { texto: 'Reservas sin complicaciones', Icono: CalendarCheck },
]

// Solo para el bloque "¿Eres entrenador?" de captación (visible sin sesión
// iniciada, se mantiene sin cambios según lo decidido).
export const PUNTOS_CAPTACION_ENTRENADOR = [
  { texto: 'Tu horario, tus normas', Icono: CalendarClock },
  { texto: 'Tú fijas el precio y las plazas', Icono: Tag },
  { texto: 'Reservas sin complicaciones', Icono: CalendarCheck },
]

export const botonPrimarioClass =
  'inline-flex h-12 items-center justify-center corte-btn bg-[#B5E600] px-8 text-base font-bold text-[#1F2400] shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:bg-[#a3d100] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'

export const botonSecundarioClass =
  'inline-flex h-12 items-center justify-center corte-btn border-2 border-white px-8 text-base font-bold text-white transition motion-safe:hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40'
