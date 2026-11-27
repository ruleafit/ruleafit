import { supabase } from '../../lib/supabaseClient'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'
import { normalizarHoras } from '../../lib/seriesSesiones'
import { precioValido } from './precio'
import { prepararUbicacionParaPublicar } from './ubicacionPublicar'
import { confirmarBonosSinSesiones } from './avisoBonos'

// Publicación de una serie de sesiones (C07). Comparte las comprobaciones del formulario con
// publicarSesion (enviarSesion.js) y crea TODAS las sesiones en una sola operación del servidor
// (publicar_serie): o se crean todas o ninguna. `previa` = useVistaPreviaSerie (validación ya hecha).
export async function publicarSerie(c, previa, setMensaje) {
  const { titulo, categoria, tipoActividad, direccion } = c
  const { puntoEncuentro, duracion, nivel, precio, plazasMax, plazasMin } = c
  const { material, observaciones, patron, repInicio, repFin } = c

  const { data } = await supabase.auth.getUser()
  const usuarioActual = data.user
  if (!usuarioActual) {
    setMensaje('Debes iniciar sesión para publicar.')
    return
  }

  // Una sola ubicación (el pin) para TODAS las sesiones de la serie: coordenadas, municipio y provincia.
  const prep = await prepararUbicacionParaPublicar(c.gestorUbicacion, setMensaje)
  if (!prep.ok) {
    setMensaje(prep.mensaje)
    return
  }
  const { lat, lng, ciudad, provincia } = prep.ubicacion

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
    if (fiscal?.estado !== 'activo') {
      setMensaje(
        fiscal?.estado === 'pendiente_revision'
          ? 'Tus datos fiscales están pendientes de revisión. Podrás publicar sesiones de pago cuando estén aprobados.'
          : 'Para publicar una sesión de pago primero añade tus datos fiscales en Mi cuenta → Datos fiscales y cobros.'
      )
      return
    }
  }

  if (Number(precio) > 0 && !(await confirmarBonosSinSesiones({ bonos: c.bonosAdmitidos }))) return

  setMensaje(`Publicando ${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}...`)

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
      provincia: provincia || null,
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
      ...(Number(precio) > 0 && c.bonosAdmitidos ? { bonos_admitidos: c.bonosAdmitidos } : {}),
    },
    p_sesiones: sesiones,
  })

  if (error) {
    const claro = /máximo|demasiadas|se acaba de publicar|solapan|repetidas|pasada|datos fiscales/i.test(error.message || '')
    setMensaje(claro ? error.message : 'No se ha podido publicar la serie. No se ha creado ninguna sesión. Revisa los datos e inténtalo de nuevo.')
    return
  }

  const n = respuesta?.creadas ?? sesiones.length
  setMensaje(`${n} ${n === 1 ? 'sesión publicada' : 'sesiones publicadas'} correctamente. Puedes gestionarlas en «Mis sesiones publicadas».`)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
  c.reiniciarTrasPublicar()
}
