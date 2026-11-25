// Ubicación definitiva al publicar (sesión individual y series C07): se toma del gestor de ubicación EN EL MOMENTO de
// publicar (no de una copia antigua del formulario), esperando a que termine la identificación del municipio si el pin
// se acaba de colocar. Devuelve { ok, ubicacion: { lat, lng, ciudad, provincia }, mensaje }.

export async function prepararUbicacionParaPublicar(gestor, setMensaje = () => {}) {
  let e = gestor.estado()
  if (e.lat == null || e.lng == null) {
    return { ok: false, mensaje: 'Busca un lugar o toca el mapa para seleccionar la ubicación antes de publicar.' }
  }
  if (e.estado === 'resolviendo') {
    setMensaje('Identificando el municipio de la ubicación…')
    e = await gestor.esperarResolucion()
  }
  if (e.estado === 'resolviendo') {
    return { ok: false, mensaje: 'Todavía estamos identificando el municipio. Inténtalo de nuevo en unos segundos o indícalo a mano bajo el mapa.' }
  }
  if (!e.ciudad) {
    return {
      ok: false,
      mensaje: 'No hemos podido identificar el municipio de este punto. Pulsa «Reintentar» o indícalo a mano bajo el mapa; la ubicación se conserva.',
    }
  }
  return { ok: true, ubicacion: { lat: e.lat, lng: e.lng, ciudad: e.ciudad, provincia: e.provincia || '' }, mensaje: '' }
}
