import { supabase } from '../../lib/supabaseClient'
import { claseYaPaso } from '../../lib/ventanaEdicionClase'
import { formatearFechaParaMostrar } from '../../lib/formatoFecha'
import { PAGOS_VISIBLES } from '../../lib/pagosVisibles'
import { precioValido } from './precio'
import { prepararUbicacionParaPublicar } from './ubicacionPublicar'

// Validaciones y envío del formulario de publicar. `c` son los campos del
// formulario (useFormularioPublicar); `setMensaje` muestra el resultado.
export async function publicarSesion(c, setMensaje) {
  const { titulo, categoria, tipoActividad, direccion } = c
  const { puntoEncuentro, fecha, hora, duracion, nivel, precio, plazasMax, plazasMin } = c
  const { material, observaciones } = c

  const { data } = await supabase.auth.getUser()
  const usuarioActual = data.user

  if (!usuarioActual) {
    setMensaje('Debes iniciar sesión para publicar.')
    return
  }

  // Una sola ubicación (el pin) determina coordenadas, municipio y provincia; se leen del gestor al publicar.
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

  // El precio, si lo hay, debe ser un importe con como máximo 2 decimales.
  if (!precioValido(precio)) {
    setMensaje('El precio debe ser un importe válido con un máximo de 2 decimales (por ejemplo 12,50).')
    return
  }

  if (claseYaPaso({ fecha, hora })) {
    setMensaje('La fecha y hora de la sesión ya han pasado. Elige un momento futuro.')
    return
  }

  // Aviso de fecha/hora duplicada (pedido por el usuario el 21 sept 2026):
  // no se bloquea, solo se avisa - puede ser intencionado (otro compañero
  // da la otra sesión).
  const { data: sesionesEnElMismoHorario } = await supabase
    .from('clases')
    .select('id')
    .eq('trainer_id', usuarioActual.id)
    .eq('estado', 'activa')
    .eq('fecha', fecha)
    .eq('hora', hora)
    .limit(1)

  if (sesionesEnElMismoHorario && sesionesEnElMismoHorario.length > 0) {
    const confirmado = window.confirm(
      `Ya tienes otra sesión programada el ${formatearFechaParaMostrar(fecha)} a las ${hora}. ¿Seguro que quieres publicar esta también?`
    )
    if (!confirmado) return
  }

  // Con los pagos activados, una sesión de pago solo se puede publicar si el
  // entrenador ya ha dado sus datos fiscales (los necesita para cobrar).
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

  setMensaje('Publicando...')

  const { error } = await supabase.from('clases').insert({
    trainer_id: usuarioActual.id,
    titulo,
    categoria,
    tipo_actividad: tipoActividad,
    ciudad,
    provincia: provincia || null,
    direccion,
    punto_encuentro: puntoEncuentro,
    fecha,
    hora,
    duracion: duracion === '' ? null : Number(duracion),
    nivel,
    precio: precio === '' ? null : Number(precio),
    plazas_max: plazasMax === '' ? null : plazasMaxNum,
    plazas_min: plazasMinNum,
    material,
    observaciones,
    estado: 'activa',
    plazas_ocupadas: 0,
    lat,
    lng,
  })

  if (error) {
    setMensaje(
      error.message?.includes('demasiados envíos')
        ? error.message
        : 'No se ha podido publicar la sesión. Revisa los datos e inténtalo de nuevo.'
    )
  } else {
    setMensaje('Sesión publicada correctamente.')
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('primera-accion'))
    c.reiniciarTrasPublicar()
  }
}
