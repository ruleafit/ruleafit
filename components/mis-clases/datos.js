export function claveFechaHora(clase) {
  return `${clase.clase_fecha} ${String(clase.clase_hora).slice(0, 5)}`
}

export function agruparAlumnosPorClase(filas) {
  const alumnosPorClase = new Map()

  for (const fila of filas) {
    let alumnos = alumnosPorClase.get(fila.clase_id)
    if (!alumnos) {
      alumnos = []
      alumnosPorClase.set(fila.clase_id, alumnos)
    }
    alumnos.push({
      reserva_id: fila.reserva_id,
      cliente_username: fila.cliente_username,
      reservado_en: fila.reservado_en,
    })
  }

  return alumnosPorClase
}

export function combinarClasesConAlumnos(clasesFilas, alumnosPorClase) {
  return clasesFilas.map((fila) => ({
    clase_id: fila.clase_id,
    clase_titulo: fila.titulo,
    clase_fecha: fila.fecha,
    clase_hora: fila.hora,
    categoria: fila.categoria,
    plazas_max: fila.plazas_max,
    plazas_min: fila.plazas_min,
    plazas_ocupadas: fila.plazas_ocupadas,
    estado: fila.estado,
    motivo_cancelacion: fila.motivo_cancelacion,
    alumnos: alumnosPorClase.get(fila.clase_id) || [],
  }))
}
