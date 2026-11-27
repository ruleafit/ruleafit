'use client'

import useMisIngresos from './useMisIngresos'
import TarjetasSaldo from './TarjetasSaldo'
import ListaIngresos from './ListaIngresos'
import ListaLiquidaciones from './ListaLiquidaciones'

export default function PantallaIngresos() {
  const { datos, error, cargando } = useMisIngresos()

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-[#1F2400]">Mis ingresos</h1>
      <p className="mt-1 mb-6 text-sm text-[#6B7355]">
        Lo que ganas con tus sesiones de pago, ya descontada la comisión de Ruleafit.
        {datos?.horas_liberacion != null && ` Pasa a disponible ${datos.horas_liberacion} horas después de terminar la sesión; los bonos, ${datos.horas_liberacion} horas después de la compra.`}
      </p>

      {cargando && <p className="text-[#6B7355]">Cargando...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {datos && (
        <>
          <TarjetasSaldo datos={datos} />
          <ListaIngresos cobros={datos.cobros} total={datos.total_cobros} />
          <ListaLiquidaciones liquidaciones={datos.liquidaciones} />
        </>
      )}
    </div>
  )
}
