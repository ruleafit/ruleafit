// Ubicación de una sesión al publicar: UNA sola ubicación activa (coordenadas del pin) que determina TODOS los datos
// geográficos (municipio y provincia). Es un pequeño autómata sin React para poder probarlo.
//
// Reglas:
//  · Elegir un resultado del buscador, tocar el mapa, elegir una ubicación habitual o cargar una sesión copiada fija
//    YA la ubicación definitiva (no hace falta tocar el mapa otra vez).
//  · Al cambiar el punto se BORRAN el municipio y la provincia anteriores (nunca se guardan datos de otro punto) y se
//    resuelven los del nuevo con la geocodificación inversa existente (lib/geocodificarInversa.js, que ya respeta la
//    cola, la caché y el límite de Nominatim).
//  · Respuestas antiguas: cada resolución lleva un número de secuencia y las coordenadas que consultó; si el punto ha
//    cambiado cuando llega, se descarta (nunca pisa a la ubicación más reciente). Cambiar el punto además cancela la
//    petición anterior.
//  · Un fallo del servicio no pierde las coordenadas: queda en estado «fallo» y se puede reintentar o corregir a mano.

export const ZOOM_BUSQUEDA = 16

// cambiada: la persona ha elegido o ajustado una ubicación (distinto de cargar la ya guardada de una sesión existente).
const VACIO = { lat: null, lng: null, ciudad: '', provincia: '', lugar: '', origen: '', estado: 'vacio', aviso: '', foco: null, cambiada: false }

// «Polideportivo Municipal, Calle X, Fuentes de Andalucía, …» → «Polideportivo Municipal»
export function nombreCortoLugar(nombre) {
  return String(nombre || '').split(',')[0].trim()
}

export function crearUbicacion({ resolver, alCambiar = () => {}, retardoMapa = 500, programar = setTimeout, cancelarProgramado = clearTimeout }) {
  let est = { ...VACIO }
  let secuencia = 0
  let temporizador = null
  let controlador = null
  let focos = 0
  let esperas = []

  function poner(cambios) {
    est = { ...est, ...cambios }
    alCambiar(est)
    if (est.estado !== 'resolviendo') {
      const pendientes = esperas
      esperas = []
      pendientes.forEach((fin) => fin(est))
    }
  }

  function cancelar() {
    secuencia += 1
    cancelarProgramado(temporizador)
    temporizador = null
    controlador?.abort()
    controlador = null
  }

  // modo 'todo': municipio y provincia; 'provincia': solo rellena la provincia que falta (no toca el municipio).
  function resolver_(modo, retardo) {
    cancelar()
    const miSecuencia = secuencia
    const { lat, lng } = est
    temporizador = programar(async () => {
      const mio = new AbortController()
      controlador = mio
      let r = null
      try {
        r = await resolver(lat, lng, { signal: mio.signal })
      } catch {
        r = null
      }
      // Respuesta antigua: otro punto elegido (o cancelación) mientras tanto → se ignora.
      if (miSecuencia !== secuencia || lat !== est.lat || lng !== est.lng) return
      if (modo === 'provincia') {
        if (r?.provincia && !est.provincia) poner({ provincia: r.provincia })
        return
      }
      if (r?.nombre) poner({ ciudad: r.nombre, provincia: r.provincia || '', estado: 'listo' })
      else poner({ ciudad: '', provincia: '', estado: 'fallo' })
    }, retardo)
  }

  const api = {
    estado: () => est,

    // Resultado del buscador de direcciones: el pin queda YA como ubicación definitiva.
    elegirBusqueda({ lat, lng, nombre }) {
      poner({ ...VACIO, lat, lng, lugar: nombreCortoLugar(nombre), origen: 'busqueda', aviso: 'busqueda', estado: 'resolviendo', cambiada: true, foco: { lat, lng, zoom: ZOOM_BUSQUEDA, n: ++focos } })
      resolver_('todo', 0)
    },

    // Toque en el mapa: otro punto, otra ubicación (el mapa no se mueve).
    elegirMapa(lat, lng) {
      poner({ ...VACIO, lat, lng, origen: 'mapa', aviso: 'ajustada', estado: 'resolviendo', foco: est.foco, cambiada: true })
      resolver_('todo', retardoMapa)
    },

    // Ubicación habitual (N09): usa sus datos guardados; si le falta la provincia se completa sin tocar el municipio.
    elegirGuardada(u) {
      cancelar()
      const completa = !!u.ciudad
      poner({
        ...VACIO, lat: u.lat, lng: u.lng, ciudad: u.ciudad || '', provincia: u.provincia || '', lugar: u.nombre || '',
        origen: 'guardada', aviso: 'guardada', estado: completa ? 'listo' : 'resolviendo', cambiada: true,
        foco: { lat: u.lat, lng: u.lng, zoom: ZOOM_BUSQUEDA, n: ++focos },
      })
      if (!completa) resolver_('todo', 0)
      else if (!u.provincia) resolver_('provincia', 0)
    },

    // Sesión copiada: sus coordenadas y municipio; la provincia (que no se copia) se obtiene del punto.
    cargar({ lat, lng, ciudad, provincia }) {
      cancelar()
      if (lat == null || lng == null) {
        poner({ ...VACIO })
        return
      }
      const completa = !!ciudad
      poner({
        ...VACIO, lat, lng, ciudad: ciudad || '', provincia: provincia || '', origen: 'copia', aviso: '',
        estado: completa ? 'listo' : 'resolviendo', foco: { lat, lng, zoom: ZOOM_BUSQUEDA, n: ++focos },
      })
      if (!completa) resolver_('todo', 0)
      else if (!provincia) resolver_('provincia', 0)
    },

    // Corrección manual excepcional (el servicio no devolvió municipio o no es el correcto).
    corregirManual({ ciudad, provincia }) {
      cancelar()
      const c = String(ciudad || '').trim()
      poner({ ciudad: c, provincia: String(provincia || '').trim(), estado: c ? 'manual' : 'fallo', cambiada: true })
    },

    reintentar() {
      if (est.lat == null) return
      poner({ ciudad: '', provincia: '', estado: 'resolviendo' })
      resolver_('todo', 0)
    },

    limpiar() {
      cancelar()
      poner({ ...VACIO })
    },

    // ¿Se puede publicar con la ubicación actual? motivo: 'sin_punto' | 'resolviendo' | 'sin_municipio'
    validar() {
      if (est.lat == null || est.lng == null) return { ok: false, motivo: 'sin_punto' }
      if (est.estado === 'resolviendo') return { ok: false, motivo: 'resolviendo' }
      if (!est.ciudad) return { ok: false, motivo: 'sin_municipio' }
      return { ok: true, motivo: '' }
    },

    // Espera (como mucho `maximoMs`) a que termine la resolución en curso; devuelve el estado final.
    esperarResolucion(maximoMs = 8000) {
      if (est.estado !== 'resolviendo') return Promise.resolve(est)
      return new Promise((resolve) => {
        const t = programar(() => {
          esperas = esperas.filter((f) => f !== fin)
          resolve(est)
        }, maximoMs)
        function fin(e) {
          cancelarProgramado(t)
          resolve(e)
        }
        esperas.push(fin)
      })
    },

    destruir() {
      cancelar()
      esperas = []
    },
  }
  return api
}
