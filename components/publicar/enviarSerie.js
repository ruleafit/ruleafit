import { supabase } from '../../lib/supabaseClient'
import { buscarCiudades } from '../../lib/geocodificar'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'
import { normalizarHoras } from '../../lib/seriesSesiones'
import { precioValido } from './precio'

// Publicación de una serie de sesiones (C07). Comparte las comprobaciones del formulario con
// publicarSesion (enviarSesion.js) y crea TODAS las sesiones en una sola operación del servidor
// (publicar_serie): o se crean todas o ninguna. `previa` = useVistaPreviaSerie (validación ya hecha).
export async function publicarSerie(c, previa, setMensaje) {
  const { titulo, categoria, tipoActividad, ciudad, ciudadTexto, provincia, direccion } = c
  const { puntoEncuentro, duracion, nivel, precio, plazasMax, plazasMin } = c
  const { material, observaciones, lat, lng, patron, repInicio, repFin } = c

  const { data } = await supabase.auth.getUser()
  const usuarioActual = data.user
  if (!usuarioActual) {
    setMensaje('Debes iniciar sesión para publicar.')
    return
  }

  if (!ciudad || ciudadTexto.trim() !== ciudad) {
    setMensaje('Elige la ciudad de la lista de sugerencias.')
    return
  }
  if (lat == null || lng == null) {
    setMensaje('Selecciona una ubicación en el mapa antes de publicar.')
    return
  }

  const plazasMaxNum = Number(plazasMax)
  const plazasMinNum = plazasMin === '' ? 0 : Number(plazasMin)
  if (!Number.isInteger(plazasMinNum) || plazasMinNum < 0 || plazasMinNum > plazasMaxNum) {
    setMensaje('Las plazas mínimas deben ser un número entero entre 0 y las plazas máximas.')
    return
  }
  if (!precioValido(precio)) {
    setMensaje('El precio debe ser un importe válido con un máximo de 2 decimales (por ejemplo 12,50).')
    return
  }

  const { errores, avisos, sesiones } = previa.validacion
  if (errores.length > 0 || sesiones.length === 0) {
    setMensaje(errores[0] || 'Revisa los días, las horas y las fechas de la serie.')
    return
  }

  // Avisos (duplicados con sesiones ya publicadas): no se bloquea, solo se confirma.
  const avisoDuplicado = avisos.find((a) => a.startsWith('Ya tienes'))
  if (avisoDuplicado) {
    const confirmado = window.confirm(`${avisoDuplicado} ¿Seguro que quieres publicar la serie igualmente?`)
    if (!confirmado) return
  }

  if (PAGOS_VISIBLES && Number(precio) > 0) {
    const { data: fiscal } = await supabase
      .from('perfiles_fiscales')
      .select('estado')
      .eq('usuario_id', usuarioActual.id)
      .maybeSingle()
    if (!fiscal || fiscal.estado === 'incompleto' || fiscal.estado === 'bloqueado') {
      setMensaje('Para publicar una sesión de pago primero añade tus datos fiscales en Mi cuenta → Datos fiscales y cobros.')
      return
    }
  }

  setMensaje(`Publicando ${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}...`)

  let provinciaFinal = provincia
  if (!provinciaFinal) {
    const candidatas = await buscarCiudades(ciudad)
    provinciaFinal = candidatas.find((ciu) => ciu.nombre === ciudad)?.provincia || ''
  }

  const patronGuardado = {
    version: 1,
    dias: [...patron.dias].sort((a, b) => a - b),
    personalizado: !!patron.personalizado,
    horas: normalizarHoras(patron.horas),
    horasPorDia: Object.fromEntries(Object.entries(patron.horasPorDia || {}).map(([k, v]) => [k, normalizarHoras(v)])),
    inicio: repInicio,
    fin: repFin,
  }

  const { data: respuesta, error } = await supabase.rpc('publicar_serie', {
    p_datos: {
      titulo,
      categoria,
      tipo_actividad: tipoActividad,
      ciudad,
      provincia: provinciaFinal || null,
      direccion,
      punto_encuentro: puntoEncuentro,
      duracion: duracion === '' ? null : Number(duracion),
      nivel,
      precio: precio === '' ? 0 : Number(precio),
      plazas_max: plazasMax === '' ? null : plazasMaxNum,
      plazas_min: plazasMinNum,
      material,
      observaciones,
      lat,
      lng,
      patron: patronGuardado,
    },
    p_sesiones: sesiones,
  })

  if (error) {
    const claro = /máximo|demasiadas|se acaba de publicar|solapan|repetidas|pasada/i.test(error.message || '')
    setMensaje(claro ? error.message : 'No se ha podido publicar la serie. No se ha creado ninguna sesión. Revisa los datos e inténtalo de nuevo.')
    return
  }

  const n = respuesta?.creadas ?? sesiones.length
  setMensaje(`${n} ${n === 1 ? 'sesión publicada' : 'sesiones publicadas'} correctamente. Puedes gestionarlas en «Mis sesiones publicadas».`)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
  c.reiniciarTrasPublicar()
}
