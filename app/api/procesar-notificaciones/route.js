import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { enviarPushAUsuario } from '../../../lib/enviarPush'
import { cronAutorizado } from '../../../lib/secretoCron'

// Cuantas notificaciones procesar por llamada (para no saturar).
const LOTE = 100
// Maximo de intentos antes de marcar una notificacion como error definitivo.
const MAX_INTENTOS = 3

export async function POST(request) {
  // 1. Verificar el secreto: solo el cron autorizado puede llamar aqui.
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // 2. Leer notificaciones pendientes (las mas antiguas primero).
  const { data: pendientes, error } = await supabaseAdmin
    .from('notificaciones_cola')
    .select('id, usuario_id, titulo, cuerpo, url, intentos')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(LOTE)

  if (error) {
    return NextResponse.json({ error: 'Error leyendo la cola' }, { status: 500 })
  }

  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ procesadas: 0, enviadas: 0 })
  }

  let procesadas = 0
  let totalEnviadas = 0

  // 3. Procesar cada una.
  for (const noti of pendientes) {
    // Reclamo atómico (C15): el procesador se ejecuta también al instante tras un cambio y cada pocos segundos, así que
    // dos ejecuciones pueden solaparse. Solo sigue quien consigue subir `intentos` desde el valor leído: la otra se salta
    // esa notificación y no hay push duplicado. (El intento queda contado, igual que antes se contaba al fallar.)
    const { data: reclamada } = await supabaseAdmin
      .from('notificaciones_cola')
      .update({ intentos: noti.intentos + 1 })
      .eq('id', noti.id)
      .eq('estado', 'pendiente')
      .eq('intentos', noti.intentos)
      .select('id')
    if (!reclamada || reclamada.length === 0) continue

    let resultado
    try {
      resultado = await enviarPushAUsuario(noti.usuario_id, {
        title: noti.titulo,
        body: noti.cuerpo,
        url: noti.url,
      })
    } catch (e) {
      // Error de configuración (p. ej. faltan claves VAPID): se devuelve el intento reclamado y queda pendiente, como antes.
      await supabaseAdmin.from('notificaciones_cola').update({ intentos: noti.intentos }).eq('id', noti.id)
      throw e
    }

    procesadas++
    totalEnviadas += resultado.enviadas

    if (resultado.enviadas > 0) {
      // Enviada correctamente al menos a un dispositivo.
      await supabaseAdmin
        .from('notificaciones_cola')
        .update({ estado: 'enviada', enviada_at: new Date().toISOString() })
        .eq('id', noti.id)
    } else {
      // No se pudo enviar a ningun dispositivo: sumar intento.
      const nuevosIntentos = noti.intentos + 1
      const nuevoEstado = nuevosIntentos >= MAX_INTENTOS ? 'error' : 'pendiente'
      await supabaseAdmin
        .from('notificaciones_cola')
        .update({ intentos: nuevosIntentos, estado: nuevoEstado })
        .eq('id', noti.id)
    }
  }

  return NextResponse.json({ procesadas, enviadas: totalEnviadas })
}
