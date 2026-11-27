import Link from 'next/link'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

export default function EnlacePro() {
  if (!PAGOS_VISIBLES) return null
  return (
    <div className="mt-6 corte-card border border-[#E2E6CF] bg-white p-4">
      <p className="text-sm font-bold text-[#1F2400]">Plan Pro</p>
      <p className="mt-1 text-sm text-[#6B7355]">Para crear y vender bonos. Contrátalo, revisa tus pagos o cancela la renovación.</p>
      <Link href="/pro" className="mt-2 inline-block text-sm font-semibold text-[#3D4A00] underline">Gestionar mi suscripción</Link>
    </div>
  )
}
