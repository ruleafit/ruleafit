// Acceso ordenado al servicio público Nominatim (OpenStreetMap). Política de uso:
// https://operations.osmfoundation.org/policies/nominatim/
//   · Máximo UNA petición por segundo: todas las consultas de la aplicación en este navegador (buscar ciudad,
//     buscar calle, geocodificación inversa…) pasan por UNA cola que deja al menos 1,1 s entre dos
//     peticiones reales. Como las consultas salen del navegador de cada persona (cada una desde su propia
//     IP), este es el límite que Nominatim mide; sumarlas en un servidor propio concentraría el tráfico de
//     toda la web en una sola IP y haría peor el límite.
//   · Una petición cancelada (la persona sigue escribiendo) se descarta sin esperar su turno ni gastarlo.
//   · Identificación: el navegador envía el encabezado Referer con el origen de la web (www.ruleafit.com);
//     se fija `referrerPolicy` para que así sea siempre.
//   · Caché: la hace cada función de geocodificación (por texto o por coordenadas redondeadas), de modo que
//     una consulta repetida no vuelve a salir.

export const INTERVALO_MINIMO_MS = 1100

function esperar(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelada', 'AbortError'))
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', alAbortar)
      resolve()
    }, ms)
    function alAbortar() {
      clearTimeout(t)
      reject(new DOMException('Cancelada', 'AbortError'))
    }
    signal?.addEventListener('abort', alAbortar, { once: true })
  })
}

// Cola que serializa las peticiones y separa su inicio al menos `intervalo` ms. `lanzar(url, opciones)`
// hace la petición real (inyectable para pruebas).
export function crearColaNominatim({ intervalo = INTERVALO_MINIMO_MS, ahora = () => Date.now(), lanzar } = {}) {
  let ultimoInicio = 0
  let cola = Promise.resolve()

  return function peticion(url, { signal } = {}) {
    const turno = cola.then(async () => {
      if (signal?.aborted) throw new DOMException('Cancelada', 'AbortError')
      const falta = ultimoInicio + intervalo - ahora()
      if (falta > 0) await esperar(falta, signal)
      if (signal?.aborted) throw new DOMException('Cancelada', 'AbortError')
      ultimoInicio = ahora()
      return lanzar(url, { signal })
    })
    cola = turno.then(() => undefined, () => undefined)
    return turno
  }
}

export const fetchNominatim = crearColaNominatim({
  lanzar: (url, { signal }) => fetch(url, { signal, referrerPolicy: 'strict-origin-when-cross-origin' }),
})
