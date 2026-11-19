import { CircleCheck, CircleAlert } from 'lucide-react'

export default function MensajePublicar({ mensaje }) {
  if (!mensaje) return null

  const esExito = mensaje === 'Sesión publicada correctamente.'
  const esProgreso = mensaje === 'Publicando...'
  const esError = !esExito && !esProgreso

  return (
    <div
      className={`mt-4 flex items-start gap-2 corte-card border px-4 py-3 text-sm ${
        esExito
          ? 'border-[#B5E600]/50 bg-[#EDF5C9] text-[#3D4A00]'
          : esError
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-[#E2E6CF] bg-white text-[#6B7355]'
      }`}
    >
      {esExito && <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />}
      {esError && <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />}
      <p className="font-medium">{mensaje}</p>
    </div>
  )
}
