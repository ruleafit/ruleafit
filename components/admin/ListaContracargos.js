'use client'

import BotonConfirmar from './BotonConfirmar'
import { formatearEuros } from '../../lib/pagos/dinero.ts'

const ESTADOS = { abierto: 'Abierto', ganado: 'Ganado', perdido: 'Perdido', anulado: 'Anulado' }
const fecha = (texto) => new Date(texto).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })

function Tarjeta({ k, onCambiar }) {
  const resolver = (resultado) => onCambiar({ accion: 'resolver', id: k.id, resultado })
  const abierto = k.estado === 'abierto'
  return (
    <li className="corte-card border border-[#E2E6CF] bg-white p-4">
      <p className="text-sm font-bold text-[#1F2400]">
        Pedido {k.cobros?.pedido_redsys} · {formatearEuros(k.importe_centimos)} · {ESTADOS[k.estado]}
      </p>
      <p className="mt-1 text-sm text-[#3d4426]">
        {k.cobros?.tipo === 'bono' ? 'Bono' : k.cobros?.clase_titulo || 'Sesión'}
        {k.username ? ` · @${k.username}` : ''} · anotado el {fecha(k.creado_en)}
        {k.referencia_banco ? ` · ref. ${k.referencia_banco}` : ''}
      </p>
      {k.motivo && <p className="mt-1 text-sm text-[#3d4426]">{k.motivo}</p>}
      {abierto && k.fecha_limite && (
        <p className="mt-1 text-sm font-semibold text-[#1F2400]">Responder antes del {fecha(k.fecha_limite)}</p>
      )}
      {!abierto && k.estado === 'perdido' && (
        <p className="mt-1 text-sm text-[#3d4426]">Descontado al organizador: {formatearEuros(k.descontado_centimos || 0)}</p>
      )}
      {abierto && (
        <div className="mt-3 flex flex-wrap gap-2">
          <BotonConfirmar
            texto="Ganado"
            pregunta="El banco te ha dado la razón. Se quita la retención y el dinero sigue su curso."
            onConfirmar={() => resolver('ganado')}
          />
          <BotonConfirmar
            texto="Perdido"
            pregunta="El banco se queda el dinero. Se descontará al organizador y, si es por todo el cobro, se cancelará la reserva futura o el bono. No se puede deshacer."
            onConfirmar={() => resolver('perdido')}
          />
          <BotonConfirmar
            texto="Anotado por error"
            pregunta="Se quita la retención sin mover dinero."
            onConfirmar={() => resolver('anulado')}
          />
        </div>
      )}
    </li>
  )
}

export default function ListaContracargos({ contracargos, onCambiar }) {
  if (!contracargos.length) return <p className="mt-6 text-sm text-[#6B7355]">No hay ningún contracargo anotado.</p>
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {contracargos.map((k) => (
        <Tarjeta key={k.id} k={k} onCambiar={onCambiar} />
      ))}
    </ul>
  )
}
