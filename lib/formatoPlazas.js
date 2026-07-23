export function textoPlazas({ esEntrenador, plazasOcupadas, plazasMax }) {
  if (esEntrenador) {
    return `${plazasOcupadas}/${plazasMax} plazas ocupadas`
  }

  const libres = Math.max(plazasMax - plazasOcupadas, 0)
  return libres === 1 ? 'Queda 1 plaza' : `Quedan ${libres} plazas`
}
