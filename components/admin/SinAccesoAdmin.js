import Link from 'next/link'

const TEXTOS = {
  'sin-sesion': 'Inicia sesión con una cuenta de administrador.',
  'sin-acceso': 'No tienes acceso a esta página.',
  error: 'No se han podido cargar los datos.',
}

export default function SinAccesoAdmin({ estado }) {
  if (estado === 'cargando') return <p className="p-8 text-center text-[#6B7355]">Cargando…</p>
  return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <p className="text-[#1F2400]">{TEXTOS[estado] || TEXTOS.error}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#3D4A00] underline">
        Volver al inicio
      </Link>
    </div>
  )
}
