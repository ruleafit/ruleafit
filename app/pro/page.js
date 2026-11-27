import { notFound } from 'next/navigation'
import PantallaPro from '../../components/pro/PantallaPro'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

export const metadata = {
  title: 'Plan Pro · Ruleafit',
  robots: { index: false, follow: false },
}

// Solo existe con los pagos online visibles.
export default function ProPage() {
  if (!PAGOS_VISIBLES) notFound()
  return <PantallaPro />
}
