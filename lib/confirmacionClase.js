export function estadoConfirmacionClase({ plazasMin, plazasOcupadas }) {
  const min = plazasMin ?? 0
  const ocupadas = plazasOcupadas ?? 0
  const tieneMinimo = min > 0
  const pendienteConfirmacion = tieneMinimo && ocupadas < min
  const faltanParaConfirmar = pendienteConfirmacion ? min - ocupadas : 0

  return { tieneMinimo, pendienteConfirmacion, faltanParaConfirmar }
}

export function textoFaltanParaConfirmar(faltanParaConfirmar) {
  return faltanParaConfirmar === 1
    ? 'Falta 1 persona para confirmar'
    : `Faltan ${faltanParaConfirmar} personas para confirmar`
}
