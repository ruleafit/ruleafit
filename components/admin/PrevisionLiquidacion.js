'use client'

import { formatearEuros } from '../../lib/pagos/dinero.ts'
import { formatearFechaParaMostrar as fecha } from '../../lib/formatoFecha'
import { MOTIVOS_EXCLUSION } from '../../lib/pagos/liquidaciones.ts'
import BotonConfirmar from './BotonConfirmar'

const APARTADOS = [
  ['retenido', 'Retenido'],
  ['en_devolucion', 'En devolución'],
  ['bonos_en_plazo', 'Bonos en plazo de devolución'],
  ['posterior', 'Liberado después del corte'],
]

// Qué se pagaría si se cierra ahora el último corte. Todo lo calcula panel_liquidaciones().
export default function PrevisionLiquidacion({ datos, onCerrar }) {
  const { periodo, prevision, minimo_centimos: minimo, liquidar_bonos_en_plazo: pagaBonos } = datos
  const nuevos = prevision.filter((f) => !f.motivo && !f.ya_incluido)

  return (
    <section className="mt-6">
      <h2 className="text-base font-bold text-[#1F2400]">
        Corte del {fecha(periodo.inicio)} al {fecha(periodo.fin)} · pago el {fecha(periodo.pago)}
      </h2>
      <p className="mt-1 text-xs text-[#6B7355]">
        Mínimo {formatearEuros(minimo)}. Los bonos que aún se pueden devolver {pagaBonos ? 'SÍ' : 'no'} se pagan. Festivos sin
        contemplar: revisa la fecha.
      </p>
      {prevision.length === 0 && <p className="mt-3 text-sm text-[#6B7355]">Nadie tiene saldo disponible.</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {prevision.map((f) => (
          <li key={f.entrenador_id} className="corte-card border border-[#E2E6CF] bg-white p-3 text-sm text-[#1F2400]">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{f.username ? `@${f.username}` : 'cuenta eliminada'}</span>
              <strong>{formatearEuros(f.a_pagar)}</strong>
            </div>
            <p className="text-xs text-[#6B7355]">
              Disponible {formatearEuros(f.disponible)}
              {APARTADOS.filter(([k]) => f[k] > 0).map(([k, t]) => ` · ${t} ${formatearEuros(f[k])}`)}
            </p>
            <p className="text-xs font-medium text-[#3D4A00]">
              {f.ya_incluido
                ? 'Ya incluido en este corte'
                : f.motivo
                  ? MOTIVOS_EXCLUSION[f.motivo] || f.motivo
                  : `Se pagará a la cuenta terminada en ${f.iban_ultimos4}`}
            </p>
          </li>
        ))}
      </ul>
      {nuevos.length > 0 && (
        <div className="mt-3">
          <BotonConfirmar
            principal
            texto="Cerrar liquidación"
            pregunta={`¿Cerrar el corte para ${nuevos.length} ${nuevos.length === 1 ? 'organizador' : 'organizadores'}? El importe sale de su saldo disponible y queda pendiente de transferir. No envía dinero.`}
            onConfirmar={onCerrar}
          />
        </div>
      )}
    </section>
  )
}
