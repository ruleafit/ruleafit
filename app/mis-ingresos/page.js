import { notFound } from 'next/navigation'
import PantallaIngresos from '../../components/ingresos/PantallaIngresos'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'

export const metadata = {
  title: 'Mis ingresos · Ruleafit',
  robots: { index: false, follow: false },
}

// Solo existe con los pagos online visibles.
export default function MisIngresosPage() {
  if (!PAGOS_VISIBLES) notFound()
  return <PantallaIngresos />
}
