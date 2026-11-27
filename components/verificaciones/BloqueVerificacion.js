'use client'

import useMisVerificaciones from './useMisVerificaciones'
import VerificacionIdentidad from './VerificacionIdentidad'
import MisTitulaciones from './MisTitulaciones'

// Contenido del desplegable «Verificación del perfil» de Mi cuenta.
export default function BloqueVerificacion({ usuario }) {
  const datos = useMisVerificaciones(usuario.id)

  if (datos.estado === 'cargando') return <p className="text-sm text-[#6B7355]">Cargando...</p>
  if (datos.estado === 'no-disponible') {
    return <p className="text-sm text-[#6B7355]">La verificación no está disponible en este momento.</p>
  }

  return (
    <div>
      <VerificacionIdentidad identidad={datos.identidad} onEnviar={datos.enviarIdentidad} onRetirar={datos.retirarIdentidad} />
      <MisTitulaciones titulaciones={datos.titulaciones} onEnviar={datos.enviarTitulacion} onRetirar={datos.retirarTitulacion} />
    </div>
  )
}
