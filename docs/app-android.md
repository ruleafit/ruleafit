# App de Android (TWA) — preparación y pasos para publicar

Decisión (31 octubre 2026): Android como **TWA** (Trusted Web Activity): una app ligera que abre
https://www.ruleafit.com en Chrome a pantalla completa, sin barra del navegador.

Por qué TWA y no una app que envuelva la web (Capacitor) para Android:
- **Inicio de sesión con Google:** Google bloquea el login dentro de un visor web incrustado; en TWA usa
  Chrome y funciona tal cual.
- **Notificaciones push:** las de la web (`public/sw.js`) funcionan en TWA sin tocar nada.
- **Actualizaciones:** cualquier cambio de la web llega al instante, sin pasar por la tienda.
- **iPhone:** no existe TWA; allí se hará con Capacitor más adelante (Apple además exige que la app aporte
  algo más que una web). Es un proyecto aparte.

## Ya preparado en el repositorio
- `app/manifest.js`: nombre, idioma, categorías, orientación vertical, iconos `any` y `maskable` y accesos
  directos (Sesiones, Mis reservas, Publicar). El logo cabe en la zona segura de los iconos adaptables.
- `app/.well-known/assetlinks.json/route.js`: sirve `/.well-known/assetlinks.json` con las huellas SHA-256
  de la variable de entorno `ANDROID_SHA256_FINGERPRINTS` (vacío mientras no exista). Paquete: `com.ruleafit.app`.
- `app/eliminar-cuenta/page.js`: dirección pública para «eliminar cuenta» que exige Google Play
  (`https://www.ruleafit.com/eliminar-cuenta`).
- Ya cumplido en la web: borrar cuenta, denunciar, bloquear, política de privacidad, términos.

## Lo que hay que hacer (en este orden)
1. **Cuenta de Google Play Console** (25 € una vez; verificación de identidad de la persona o empresa).
   Cuenta personal nueva: Google exige una prueba cerrada con **12 testers durante 14 días** antes de poder
   publicar en producción. Conviene empezarla cuanto antes.
2. **Generar la app con Bubblewrap** (herramienta oficial de Google; descarga ella sola el JDK y el SDK de
   Android; no hace falta Android Studio). Datos del proyecto:
   - Dirección del manifiesto: `https://www.ruleafit.com/manifest.webmanifest`
   - Nombre del paquete: `com.ruleafit.app`
   - Color de la barra de estado `#B5E600`, fondo `#FBFAF3`
   - Habilitar notificaciones de Chrome (push de la web): sí
   - Clave de firma: la crea Bubblewrap y **la contraseña la escribes tú**. Guardar el archivo `.keystore` y la
     contraseña fuera del repositorio y con copia de seguridad (sin ella no se puede actualizar la app).
   - Resultado: un `.aab` (el archivo que se sube a Play) y un `.apk` para probar en el móvil.
3. **Probar el `.apk`** en un móvil Android: instalarlo y comprobar que abre la web, el inicio de sesión
   con Google, las notificaciones y el mapa.
4. **Subir el `.aab`** a Play Console (prueba cerrada) y activar **Play App Signing**. En Play Console →
   Configuración → Firma de la aplicación, copiar la huella **SHA-256** del certificado de firma de la app
   y la de la clave de subida.
5. **Poner las huellas en Vercel**: variable `ANDROID_SHA256_FINGERPRINTS` (ambas, separadas por comas) y
   redesplegar. Comprobar que `https://www.ruleafit.com/.well-known/assetlinks.json` las muestra. Sin este
   paso, la app se ve con una barra de navegador arriba.
6. **Ficha de la tienda** (textos de abajo), capturas, icono 512 × 512 y gráfico de 1024 × 500.
7. Formularios de Play: seguridad de los datos, clasificación de contenido, público objetivo (+18 recomendado
   por los pagos y los menores), declaración de anuncios (no hay) y de la dirección de eliminación de cuenta.

## Textos de la ficha (borrador, español)
**Nombre:** Ruleafit: sesiones de entreno

**Descripción corta (máx. 80):** Reserva sesiones sueltas de entrenamiento cerca de ti. Sin cuota.

**Descripción completa:**
Ruleafit conecta a personas que quieren entrenar con entrenadores que organizan sesiones sueltas, en toda
España. Sin gimnasio, sin cuota y sin permanencia: eliges una sesión, reservas tu plaza y vas.

• Encuentra sesiones por actividad, ciudad, fecha y horario, en lista o en mapa.
• Si en tu ciudad no hay sesiones, te mostramos las más cercanas.
• Reserva tu plaza en segundos y cancela fácilmente.
• Sigue a tus entrenadores favoritos y recibe avisos de sus nuevas sesiones.
• ¿Entrenas a otros? Publica tus propias sesiones y gestiona tus reservas.
• Gana Rulos, los puntos de Ruleafit, al asistir a sesiones.
• Comparte cualquier sesión con tus amigos por WhatsApp, Instagram y más.

**Categoría:** Salud y bienestar (o Deportes). **Etiquetas:** entrenamiento, fitness, deporte, clases.

## Datos para el formulario «Seguridad de los datos» (revisar con el asesor)
- Recoge: correo, nombre de usuario, foto de perfil (opcional), ubicación aproximada (solo si el usuario
  la activa), contenido del usuario (sesiones, valoraciones), identificadores del dispositivo para las
  notificaciones.
- No se venden datos. Se cifran en tránsito (HTTPS). El usuario puede pedir su borrado: sí (ver arriba).
- Pagos online: cuando se activen, el pago lo gestiona el banco (Ruleafit no ve los datos de la tarjeta).

## Pendiente conocido
- Capturas de pantalla de teléfono (mínimo 2) y gráfico de funciones 1024 × 500: se generan desde la web.
- Revisar la política de privacidad con el asesor antes de publicar (ver `legal/borradores/`).

## Estado a 8 noviembre 2026: app generada y probada, SIN publicar
- Generada con Bubblewrap en `C:\Users\34722\ruleafit-android` (fuera del repositorio): `app-release-bundle.aab` (para Play) y `app-release-signed.apk` (para probar). Paquete `com.ruleafit.app`, versión 1 (versionCode 1; hay que subirlo en cada nueva subida a Play).
- Clave de firma: `android.keystore`, alias `ruleafit`, en esa misma carpeta. Las contraseñas las guarda el usuario. **Sin ese archivo y su contraseña no se puede actualizar la app.** Hay que tener copia fuera del PC.
- Huella SHA-256 de la clave (no es secreta): `41:E9:2F:04:32:06:D5:9F:17:63:01:10:92:13:4B:AC:0F:D3:23:16:FD:A7:47:67:D8:C7:BE:29:37:A7:47:30`. Está en la variable `ANDROID_SHA256_FINGERPRINTS` de Vercel y `/.well-known/assetlinks.json` la sirve (comprobado). Al subir a Play con Play App Signing hay que AÑADIR la huella que muestre Play Console (separadas por comas).
- Probado en un móvil Android por el usuario: la web carga y todo va bien en principio.

### Cómo volver a compilar (Windows)
- Hay que lanzar Bubblewrap desde `cmd`, no desde PowerShell (PowerShell no encuentra `gradlew.bat`):
  `cmd /c "cd /d C:\Users\34722\ruleafit-android && npx @bubblewrap/cli build"`
- Si pregunta por aplicar cambios de `twa-manifest.json`, responder No (se retocaron a mano `minSdkVersion` a 24 en `twa-manifest.json` y `app/build.gradle`, porque la librería de Chrome lo exige, y `org.gradle.jvmargs` a `-Xmx768m` en `gradle.properties` por falta de memoria libre). Si se responde Sí, hay que repetir esos cambios.
- Pide las dos contraseñas (almacén y clave). Cerrar programas pesados antes; si falla por memoria, reiniciar el PC.
- Herramientas descargadas por Bubblewrap en `C:\Users\34722\.bubblewrap` (JDK 17 y SDK de Android).
- Como la app solo abre la web, los cambios de la web llegan a la app sin recompilar. Solo hace falta una nueva versión (aumentando versionCode) si se cambia algo de la propia app: icono, nombre, permisos.

### Pendiente cuando se quiera publicar
Cuenta de Google Play Console (25 €, verificación de identidad; si es personal y nueva, prueba cerrada con 12 testers durante 14 días), capturas de pantalla, gráfico de 1024 × 500, icono de 512 × 512, formularios de Play y revisión legal.
