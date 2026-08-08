import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'

// Configurar web-push con las claves VAPID (una sola vez).
webpush.setVapidDetails(
  'mailto:openfit2026@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Envia una notificacion a TODAS las suscripciones de un usuario.
// payload = { title, body, url }
// Devuelve { enviadas, fallidas }. Si una suscripcion esta caducada (404/410),
// la borra de push_subscriptions para no reintentarla siempre.
export async function enviarPushAUsuario(usuarioId, payload) {
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('usuario_id', usuarioId)

  if (error || !subs || subs.length === 0) {
    return { enviadas: 0, fallidas: 0 }
  }

  let enviadas = 0
  let fallidas = 0

  for (const sub of subs) {
    const suscripcion = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }
    try {
      await webpush.sendNotification(suscripcion, JSON.stringify(payload))
      enviadas++
    } catch (err) {
      fallidas++
      // 404 o 410 = suscripcion caducada/invalida: la borramos.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return { enviadas, fallidas }
}
