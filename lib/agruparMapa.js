// Agrupación de sesiones del mapa EN EL ZOOM MÁXIMO (funciones puras, sin Leaflet ni React).
//
// Hasta el zoom máximo el mapa funciona como siempre (círculos con el número de sesiones
// que se separan al ampliar). Solo en el zoom máximo, las sesiones que siguen
// superpuestas se agrupan POR ORGANIZADOR: una foto por organizador, nunca una por sesión.

// Los marcadores de organizador miden 44 px: más cerca que esto se solapan.
export const UMBRAL_SOLAPE_PX = 46
// Fotos de organizadores que se reparten alrededor de un punto antes de pasar a una lista.
export const MAX_FOTOS_POR_PUNTO = 24

export function claveFechaHora(s) {
  return `${s.fecha || ''} ${s.hora || ''}`
}

// Más próximas primero (fecha y hora; texto ordenable 'YYYY-MM-DD' + 'HH:MM[:SS]').
export function ordenarSesiones(sesiones) {
  return [...sesiones].sort((a, b) => {
    const ka = claveFechaHora(a)
    const kb = claveFechaHora(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  })
}

// Agrupa las sesiones que se solapan visualmente (encadenando: si A solapa con B y B con C,
// las tres forman un grupo). proyectar(sesion) -> {x, y} en píxeles al zoom máximo.
// Devuelve [{ sesiones, x, y }] con el centro (media) en píxeles.
export function agruparPorUbicacion(sesiones, proyectar, umbral = UMBRAL_SOLAPE_PX) {
  const pts = sesiones.map((s) => ({ s, ...proyectar(s) }))
  const padre = pts.map((_, i) => i)
  const raiz = (i) => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]]
      i = padre[i]
    }
    return i
  }

  const celdas = new Map()
  pts.forEach((p, i) => {
    p.cx = Math.floor(p.x / umbral)
    p.cy = Math.floor(p.y / umbral)
    const k = `${p.cx},${p.cy}`
    if (!celdas.has(k)) celdas.set(k, [])
    celdas.get(k).push(i)
  })

  pts.forEach((p, i) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const lista = celdas.get(`${p.cx + dx},${p.cy + dy}`)
        if (!lista) continue
        for (const j of lista) {
          if (j <= i) continue
          if (Math.hypot(pts[j].x - p.x, pts[j].y - p.y) < umbral) {
            const a = raiz(i)
            const b = raiz(j)
            if (a !== b) padre[b] = a
          }
        }
      }
    }
  })

  const grupos = new Map()
  pts.forEach((p, i) => {
    const r = raiz(i)
    if (!grupos.has(r)) grupos.set(r, [])
    grupos.get(r).push(p)
  })

  return [...grupos.values()].map((lista) => ({
    sesiones: lista.map((p) => p.s),
    x: lista.reduce((a, p) => a + p.x, 0) / lista.length,
    y: lista.reduce((a, p) => a + p.y, 0) / lista.length,
  }))
}

// Un elemento por organizador, con sus sesiones ordenadas. Organizadores ordenados por su
// próxima sesión y, a igualdad, por nombre (orden estable).
export function agruparPorOrganizador(sesiones) {
  const mapa = new Map()
  for (const s of sesiones) {
    const id = s.trainer_id ?? `anon-${s.id}`
    if (!mapa.has(id)) mapa.set(id, { trainerId: id, perfil: s.perfiles || null, sesiones: [] })
    mapa.get(id).sesiones.push(s)
  }
  const lista = [...mapa.values()].map((o) => ({ ...o, sesiones: ordenarSesiones(o.sesiones) }))
  return lista.sort((a, b) => {
    const ka = claveFechaHora(a.sesiones[0])
    const kb = claveFechaHora(b.sesiones[0])
    if (ka !== kb) return ka < kb ? -1 : 1
    return String(a.perfil?.username || '').localeCompare(String(b.perfil?.username || ''))
  })
}

// Reparte n marcadores en anillos concéntricos alrededor de (0,0), sin que se solapen entre
// sí (separación mínima ~52 px entre centros). Devuelve [{dx, dy}] en píxeles.
export function distribuirEnAnillos(n, separacion = 52, radioBase = 44) {
  const posiciones = []
  let anillo = 0
  while (posiciones.length < n) {
    const radio = radioBase + anillo * separacion * 0.95
    const capacidad = Math.max(3, Math.floor((2 * Math.PI * radio) / separacion))
    const enEste = Math.min(capacidad, n - posiciones.length)
    const giro = anillo % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / capacidad
    for (let k = 0; k < enEste; k++) {
      const ang = giro + (2 * Math.PI * k) / enEste
      posiciones.push({ dx: Math.cos(ang) * radio, dy: Math.sin(ang) * radio })
    }
    anillo++
  }
  return posiciones
}

// Decide qué se dibuja para UN grupo de sesiones solapadas.
// Devuelve { marcadores: [{ tipo, ... }] } con desplazamientos en píxeles respecto al centro:
//  · tipo 'sesion'      organizador con 1 sesión → marcador normal con su ventana habitual
//  · tipo 'organizador' organizador con varias   → su foto; al pulsar, listado de sus sesiones
//  · tipo 'mas'         demasiados organizadores → «+N» que abre la lista de organizadores
export function disenarGrupo(grupo) {
  const organizadores = agruparPorOrganizador(grupo.sesiones)

  if (organizadores.length === 1) {
    const o = organizadores[0]
    return {
      organizadores,
      marcadores: [
        o.sesiones.length === 1
          ? { tipo: 'sesion', sesion: o.sesiones[0], dx: 0, dy: 0 }
          : { tipo: 'organizador', organizador: o, dx: 0, dy: 0 },
      ],
    }
  }

  const exceso = organizadores.length > MAX_FOTOS_POR_PUNTO
  const visibles = exceso ? organizadores.slice(0, MAX_FOTOS_POR_PUNTO - 1) : organizadores
  const pos = distribuirEnAnillos(visibles.length)
  const marcadores = visibles.map((o, i) => ({
    tipo: o.sesiones.length === 1 ? 'sesion' : 'organizador',
    ...(o.sesiones.length === 1 ? { sesion: o.sesiones[0] } : { organizador: o }),
    dx: pos[i].dx,
    dy: pos[i].dy,
  }))
  if (exceso) marcadores.push({ tipo: 'mas', restantes: organizadores.length - visibles.length, organizadores, dx: 0, dy: 0 })
  return { organizadores, marcadores }
}
