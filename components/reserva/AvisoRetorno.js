'use client'

import { useEffect, useState } from 'react'
import { ingerirVolverDeUrl, leerRetorno } from '../../lib/retorno'
import { leerInvitacion } from '../../lib/invitacion'

const ACCIONES = {
  reservar: ['Vas a reservar', 'Al terminar volverás a ella para confirmar tu reserva.'],
  avisar: ['Vas a activar un aviso para', 'Al terminar volverás a ella para confirmar la activación del aviso.'],
  seguir: ['Vas a seguir a', 'Al terminar volverás a su perfil para confirmarlo.'],
  favorito: ['Vas a añadir a favoritos a', 'Al terminar volverás a su perfil para confirmarlo.'],
}

// C03/C15/C25 · Aviso en /login y /registro cuando se llega desde el panel de identificación (reservar, avisar,
// seguir o favorito) o desde una invitación. También recoge ?volver=<ruta interna> de la URL (validado) para que el
// retorno funcione aunque el almacenamiento estuviera vacío. La invitación y el retorno son independientes.
export default function AvisoRetorno({ className = '', mostrarInvitacion = false }) {
  const [retorno, setRetorno] = useState(null)
  const [invitado, setInvitado] = useState(false)
  useEffect(() => {
    setRetorno(ingerirVolverDeUrl() || leerRetorno())
    setInvitado(!!leerInvitacion())
  }, [])
  if (!retorno && !(mostrarInvitacion && invitado)) return null
  const [antes, despues] = ACCIONES[retorno?.intencion] || ACCIONES.reservar
  const caja = `rounded-lg border border-[#B5E600]/50 bg-[#EDF5C9] px-4 py-3 text-sm text-[#3D4A00] ${className}`
  return (
    <div className="flex flex-col gap-2">
      {mostrarInvitacion && invitado && (
        <p className={caja}>
          <strong>Te han invitado a RuleaFit.</strong> Al completar tu registro conseguirás 20 Rulos extra por tu invitación
          (además de tus 20 Rulos de bienvenida).
        </p>
      )}
      {retorno && (
        <p className={caja}>
          {retorno.titulo ? (
            <>{antes} <strong>{retorno.titulo}</strong>. </>
          ) : (
            'Tienes una selección pendiente. '
          )}
          {despues}
        </p>
      )}
    </div>
  )
}
