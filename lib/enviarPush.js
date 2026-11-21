import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'

// Configura web-push con las claves VAPID la primera vez que se envía algo (no al
// importar el módulo). Así la web compila y arranca aunque no haya claves, por
// ejemplo en un despliegue de pruebas que no envía notificaciones. Si se intenta
// enviar sin claves se lanza un error claro: la ruta responde 500 y las
// notificaciones se quedan pendientes en la cola (no se pierden ni se marcan como
// error). Con las claves configuradas el comportamiento es el de siempre.
let vapidConfigurado = false

function configurarVapid() {
  if (vapidConfigurado) return
  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const clavePrivada = process.env.VAPID_PRIVATE_KEY
  if (!clavePublica || !clavePrivada) {
    throw new Error(
      'Faltan las claves VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY): no se pueden enviar notificaciones push.'
    )
  }
  webpush.setVapidDetails('mailto:ruleafit@gmail.com', clavePublica, clavePrivada)
  vapidConfigurado = true
}

// Envia una notificacion a TODAS las suscripciones de un usuario.
// payload = { title, body, url }
// Devuelve { enviadas, fallidas }. Si una suscripcion esta caducada (404/410),
// la borra de push_subscriptions para no reintentarla siempre.
export async function enviarPushAUsuario(usuarioId, payload) {
  configurarVapid()

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
