# Ruleafit para iPhone (Capacitor)

La app abre https://www.ruleafit.com dentro de una app nativa. **Carga la web de producción**, así que
los cambios de la web llegan a la app sin recompilar; solo hay que recompilar si cambia algo de esta carpeta.
Plan completo y fases: `../docs/app-ios.md`.

## Probarla en tu iPhone (fase A, sin pagar nada a Apple)
Necesitas un Mac con Xcode (gratis en la App Store), Node 20 o superior, el iPhone y un cable.

1. Abre Xcode una vez y acepta la licencia. En Xcode → Settings → Accounts, añade tu Apple ID.
2. En una terminal del Mac:
   ```
   cd ruta/al/repositorio/app-ios
   npm install
   npx cap sync ios
   npx cap open ios
   ```
3. En Xcode, selecciona el proyecto **App** (izquierda) → target **App** → pestaña **Signing & Capabilities**:
   - **Team:** tu Apple ID (Personal Team).
   - **Bundle Identifier:** `com.ruleafit.app`. Si Xcode dice que no está disponible, usa
     `com.ruleafit.app.pruebas` solo para probar (el enlace de retorno del login no depende de esto).
4. Conecta el iPhone, desbloquéalo y pulsa «Confiar». Activa el **Modo desarrollador**
   (Ajustes → Privacidad y seguridad → Modo desarrollador; reinicia el iPhone).
5. Arriba en Xcode elige tu iPhone como destino y pulsa ▶. La primera vez, en el iPhone:
   Ajustes → General → VPN y gestión de dispositivos → confía en tu Apple ID.
6. Con Apple ID gratuito la app **caduca a los 7 días**: se vuelve a instalar con ▶.

## Imprescindible para el login con Google
En Supabase → Authentication → URL Configuration → **Redirect URLs**, añade:
`com.ruleafit.app://auth/callback`
Sin eso, el botón de Google dentro de la app no puede volver a la app.

## Qué comprobar en el iPhone
- La app abre con la pantalla de carga lima y carga la web a pantalla completa, sin barra de Safari.
- Iniciar sesión con correo y con Google (se abre una hoja del navegador y vuelve a la app).
- «Ver mi ubicación» en el mapa (pregunta el permiso una sola vez).
- Compartir una sesión (menú nativo; «Compartir imagen para historia» → «Guardar imagen»).
- Reservar una sesión (vibración al confirmar).
- En la app NO deben verse: «Instalar app», el bloque de Notificaciones de Mi cuenta ni «Descargar imagen».
- Borrar cuenta, denunciar y bloquear funcionan igual que en la web.

## Qué hay aquí
- `capacitor.config.json`: dirección de la web, colores, pantalla de carga y user agent `RuleafitApp`
  (la web lo usa para ocultar lo que solo vale en navegador).
- `ios/`: proyecto de Xcode. `Info.plist` ya lleva el permiso de ubicación y de guardar fotos (en español),
  el enlace `com.ruleafit.app://` para el retorno del login, solo iPhone y solo vertical.
- `www/index.html`: pantalla que sale solo si no hay conexión.
- Icono (1024 px, sin transparencia) y pantalla de carga en `ios/App/App/Assets.xcassets`.

## Pendiente con la cuenta de pago de Apple (99 €/año)
Iniciar sesión con Apple, notificaciones push nativas (el proyecto ya incluye el plugin, falta la capacidad
Push y la clave APNs), TestFlight y la ficha del App Store. Ver `../docs/app-ios.md`.
