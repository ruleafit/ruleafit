import { ESTADOS } from '../../lib/verificaciones/reglas'
import { COLOR_ESTADO } from './estilos'

const MENSAJES = {
  aprobada: 'Comprobado. Tu insignia ya está visible.',
  rechazada: 'No hemos podido aprobarlo: mira el motivo.',
  pendiente: 'Recibido. Lo revisará una persona del equipo.',
}

// Estado de la última solicitud y resultado de la comprobación recién hecha.
export default function EstadoSolicitud({ solicitud, resultado }) {
  return (
    <>
      {resultado && (
        <p role="status" className="mt-3 text-sm font-semibold text-[#3D4A00]">{MENSAJES[resultado.resultado]}</p>
      )}
      {solicitud && (
        <p className="mt-3">
          <span className={`inline-block corte-tag border px-3 py-1 text-xs font-bold ${COLOR_ESTADO[solicitud.estado]}`}>
            {ESTADOS[solicitud.estado]}
          </span>
          {solicitud.motivo && <span className="mt-2 block text-sm text-red-700">Motivo: {solicitud.motivo}</span>}
        </p>
      )}
    </>
  )
}
