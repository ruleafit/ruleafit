// N11 · Agrupación de sesiones por organizador y día en «Explora y reserva».
// Es solo presentación: recibe la lista YA filtrada (la misma que recibe el mapa, que no se toca) y devuelve
// grupos { clave, principal, resto, total }. `fecha` es la fecha de celebración (Europe/Madrid, como se guarda).

const claveHora = (c) => `${c.fecha} ${String(c.hora || '').slice(0, 5)}`

function comparar(a, b) {
  const ka = claveHora(a)
  const kb = claveHora(b)
  if (ka !== kb) return ka < kb ? -1 : 1
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0
}

// cronologico = true: grupos por fecha y hora de su primera sesión. false: se respeta el orden de entrada
// (p. ej. «las más cercanas», ordenadas por distancia); dentro de cada grupo siempre por hora.
export function agruparSesiones(clases, { cronologico = true } = {}) {
  const vistas = new Set()
  const unicas = []
  for (const c of clases || []) {
    if (vistas.has(c.id)) continue // sin duplicados
    vistas.add(c.id)
    unicas.push(c)
  }
  const base = cronologico ? [...unicas].sort(comparar) : unicas

  const grupos = new Map()
  for (const c of base) {
    const clave = `${c.trainer_id}|${c.fecha}`
    let g = grupos.get(clave)
    if (!g) grupos.set(clave, (g = { clave, sesiones: [] }))
    g.sesiones.push(c)
  }
  return [...grupos.values()].map(({ clave, sesiones }) => {
    const ordenadas = [...sesiones].sort(comparar)
    return { clave, principal: ordenadas[0], resto: ordenadas.slice(1), total: ordenadas.length }
  })
}

// El desplegable solo sigue abierto si el grupo conserva exactamente las mismas sesiones.
export function firmaGrupo(g) {
  return [g.principal, ...g.resto].map((c) => c.id).join(',')
}

export function textoVerMas(n) {
  return n === 1 ? 'Ver 1 sesión más de este día' : `Ver ${n} sesiones más de este día`
}
