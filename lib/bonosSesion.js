// Bonos que admite una sesión (clases.bonos_admitidos, sql/113): null/undefined = todos; [] = ninguno; lista = solo
// esos. La base de datos aplica la misma regla en reservar_clase(): si cambia una, cambiar ambas.
export function sesionAdmiteBono(admitidos, bonoId) {
  return admitidos == null || admitidos.includes(bonoId)
}

// Marca o desmarca un bono. `todos` = ids de los bonos propios; si quedan todos marcados se vuelve a null.
export function alternarBono(admitidos, bonoId, todos) {
  const actual = admitidos ?? todos
  const nuevo = actual.includes(bonoId) ? actual.filter((x) => x !== bonoId) : [...actual, bonoId]
  return todos.every((x) => nuevo.includes(x)) ? null : nuevo
}
