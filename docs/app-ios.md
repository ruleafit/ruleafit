# App de iPhone (Capacitor) — plan

Decisión (8 noviembre 2026): app de iOS con **Capacitor**, que mete la web https://www.ruleafit.com
dentro de una app nativa (WKWebView) y deja añadir funciones nativas. Se hace en un Mac con Xcode;
el código del proyecto se prepara en este repositorio desde Windows y se compila en el Mac.

Bundle ID: `com.ruleafit.app` (el mismo que Android).

## Qué exige Apple y cómo se cubre
| Norma de Apple | Estado |
|---|---|
| Borrar cuenta desde la app (5.1.1) | Hecho (`/cuenta`, `/eliminar-cuenta`) |
| Denunciar y bloquear contenido de usuarios (1.2) | Hecho |
| Política de privacidad accesible | Hecho (`/privacidad`); revisar con el asesor |
| Si hay login de terceros (Google), ofrecer también «Iniciar sesión con Apple» (4.8) | **Falta** (fase C, requiere cuenta de pago) |
| La app no puede ser solo una web (4.2) | **Falta**: se cubre con funciones nativas (fase D) |
| Cuenta de demostración para los revisores | **Falta**: crear un usuario de pruebas y darlo en la ficha |
| Cobros de servicios que se prestan fuera de la app (3.1.3) | Sin compras dentro de la app: no hace falta el sistema de pago de Apple |

## Fases
**A. Probar la web dentro de una app en tu iPhone (gratis, sin cuenta de pago).**
- Carpeta `app-ios/` con su propio `package.json` (así no se mezcla con la web ni con el despliegue de Vercel),
  configuración de Capacitor apuntando a `https://www.ruleafit.com` y proyecto de Xcode.
- En el Mac: Xcode (gratis), Node, `git pull`, `npm install`, `npx cap add ios`, abrir en Xcode, conectar el
  iPhone por cable y ejecutar con tu Apple ID gratuito («Personal Team»). La app caduca a los 7 días y se
  reinstala desde Xcode.
- Limitación esperada en esta fase: el **login con correo y contraseña funciona; el de Google no** (Google bloquea
  el login dentro de un visor web incrustado). Se arregla en la fase B.

**B. Login con Google por el navegador del sistema (cambia la autenticación de la web; requiere tu OK).**
- En la app nativa, el botón de Google abre el navegador del sistema (`@capacitor/browser`) y vuelve con un enlace
  `com.ruleafit.app://auth/callback` (`@capacitor/app`); se canjea el código con Supabase. La web normal no cambia.
- Hay que añadir ese enlace en Supabase → Authentication → URL Configuration → Redirect URLs (lo haces tú).

**C. Requiere cuenta Apple Developer (99 € al año).**
- Iniciar sesión con Apple: proveedor Apple en Supabase (Services ID y clave en la cuenta de Apple) + botón en
  login y registro.
- Notificaciones push nativas: clave APNs, tabla de tokens de dispositivo y envío desde el servidor (las actuales
  son de web y en iPhone no sirven dentro de la app).
- TestFlight para repartir la app a testers sin cables ni caducidad.

**D. Funciones nativas para pasar la revisión (4.2).**
- Compartir con el menú nativo (`@capacitor/share`), ubicación nativa (`@capacitor/geolocation`), push nativas
  (fase C), icono y pantalla de carga propios, y vibración o haptics en las acciones principales.

**E. Ficha y envío a revisión.**
- Capturas (6,9" y 6,5"), descripción (la de `docs/app-android.md` sirve de base), categoría, etiquetas de
  privacidad, URL de privacidad y de soporte, clasificación por edad, cuenta de demostración y notas para el revisor.

## Librerías nuevas (solo dentro de `app-ios/`, no tocan la web)
`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` (fase A); `@capacitor/browser`, `@capacitor/app` (fase B);
`@capacitor/share`, `@capacitor/geolocation`, `@capacitor/push-notifications` (fases C y D).

## Qué necesita cada fase del usuario
- A: un Mac con Xcode, el iPhone y un cable.
- B: añadir la URL de retorno en Supabase.
- C: pagar los 99 € de Apple Developer y crear el Services ID y las claves.
- E: cuenta de demostración, textos y capturas aprobadas.

## Estado a 8 noviembre 2026: fases A, B y D construidas (sin probar en iPhone todavía)
Hecho en el repositorio (preparado desde Windows; no se puede compilar aquí):
- `app-ios/`: proyecto Capacitor 8 con Xcode generado (Swift Package Manager), Info.plist (ubicación, fotos, enlace `com.ruleafit.app://`, solo iPhone, solo vertical), icono 1024 y pantalla de carga lima, plugins: app, browser, geolocation, haptics, share, splash-screen, status-bar y push-notifications. Guía de pruebas en `app-ios/README.md`.
- Web (`lib/nativo.js`, `components/ManejadorApp.js`): login con Google por el navegador del sistema dentro de la app (la web normal no cambia), ubicación nativa, vibración al reservar, y `.solo-web` para ocultar en la app «Instalar app», el bloque de notificaciones web y «Descargar imagen».
- Probado: build, lógica de `lib/nativo.js` con un puente de Capacitor simulado (login con tokens y con código, ignorar enlaces ajenos, ubicación, vibración, no actuar fuera de la app) y que la web normal sigue igual y la app oculta lo que toca.
- NO probado: nada dentro de un iPhone real (compilación en Xcode, retorno del login desde Safari, permiso de ubicación, menú de compartir).
- Gestos (solo dentro de la app y en la web instalada en iPhone, ver `usaGestosPropios()` en `lib/nativo.js`): deslizar desde el borde izquierdo para volver atrás (`components/GestoAtras.js`) y tirar hacia abajo desde lo alto para recargar (`components/GestoRefrescar.js`). Se hacen en la web, sin recompilar. Si se activa el gesto nativo de WKWebView (`allowsBackForwardNavigationGestures`, requiere una subclase en Swift y compilar en el Mac), hay que quitar `GestoAtras`.
- Enlaces universales (que un enlace de una sesión se abra en la app y no en Safari): la web ya sirve `/.well-known/apple-app-site-association` (rutas `/clases/*` y `/entrenador/*`), vacío hasta que se ponga la variable `APPLE_TEAM_ID` en Vercel. Con la cuenta de pago hay que: añadir en Xcode la capacidad Associated Domains con `applinks:www.ruleafit.com`, poner `APPLE_TEAM_ID` (identificador de equipo de Apple), recompilar, y que la app navegue a la ruta recibida (en `components/ManejadorApp.js`, hoy solo gestiona el retorno del login).
- Falta con cuenta de pago: Iniciar sesión con Apple (obligatorio por tener Google), push nativas (capacidad Push, clave APNs, tabla de tokens y envío desde el servidor), TestFlight y ficha del App Store (capturas, cuenta de demostración, etiquetas de privacidad).
