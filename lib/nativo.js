// Utilidades para cuando la web se abre dentro de la app nativa de iPhone
// (Capacitor, carpeta app-ios). Fuera de la app no hacen nada especial.
// No se importa ninguna librería de Capacitor: al cargar la web desde su
// dirección, la app inyecta el puente nativo en window.Capacitor.

export const ESQUEMA_APP = 'com.ruleafit.app'
const RETORNO_LOGIN = `${ESQUEMA_APP}://auth/callback`

export function esApp() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

function plugin(nombre) {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.[nombre] : undefined
}

// Vibración suave: 'ligero' al tocar, 'exito' al confirmar una acción importante.
export async function vibrar(tipo = 'ligero') {
  const haptics = plugin('Haptics')
  if (!esApp() || !haptics) return
  try {
    if (tipo === 'exito') await haptics.notification({ type: 'SUCCESS' })
    else await haptics.impact({ style: 'LIGHT' })
  } catch {
    // sin vibración no pasa nada
  }
}

// Ubicación actual { lat, lng }. En la app usa el permiso nativo (pregunta una
// sola vez); en el navegador, la API de siempre. Rechaza si no se puede obtener.
export async function obtenerPosicion() {
  const geo = plugin('Geolocation')
  if (esApp() && geo) {
    const permisos = await geo.checkPermissions().catch(() => null)
    if (permisos && permisos.location === 'prompt') await geo.requestPermissions().catch(() => null)
    const posicion = await geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 })
    return { lat: posicion.coords.latitude, lng: posicion.coords.longitude }
  }
  return new Promise((resolver, rechazar) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      rechazar(new Error('sin geolocalización'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => rechazar(e)
    )
  })
}

// Google no deja iniciar sesión dentro de un visor web incrustado. En la app se
// abre el navegador del sistema y, al terminar, vuelve con un enlace
// com.ruleafit.app://auth/callback que recoge escucharRetornoLogin().
export async function entrarConGoogleEnApp(supabase) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: RETORNO_LOGIN,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  })
  const navegador = plugin('Browser')
  if (error || !data?.url || !navegador) return { error: error || new Error('sin navegador') }
  await navegador.open({ url: data.url })
  return {}
}

// Recoge el regreso del login con Google: cierra el navegador, guarda la sesión
// (código o tokens, según el flujo de Supabase) y llama a alTerminar(). Devuelve
// una función para dejar de escuchar.
export function escucharRetornoLogin(supabase, alTerminar) {
  const app = plugin('App')
  if (!esApp() || !app?.addListener) return () => {}

  let escucha = null
  Promise.resolve(
    app.addListener('appUrlOpen', async ({ url }) => {
      if (!url || !url.startsWith(RETORNO_LOGIN)) return
      try {
        await plugin('Browser')?.close?.()
      } catch {
        // el navegador ya estaba cerrado
      }
      try {
        const enlace = new URL(url)
        const hash = new URLSearchParams(enlace.hash.replace(/^#/, ''))
        const codigo = enlace.searchParams.get('code')
        if (codigo) {
          await supabase.auth.exchangeCodeForSession(codigo)
        } else if (hash.get('access_token') && hash.get('refresh_token')) {
          await supabase.auth.setSession({
            access_token: hash.get('access_token'),
            refresh_token: hash.get('refresh_token'),
          })
        }
      } catch {
        // si falla, el usuario sigue en el login y puede reintentar
      }
      alTerminar()
    })
  ).then((e) => {
    escucha = e
  })

  return () => {
    if (escucha?.remove) escucha.remove()
  }
}
