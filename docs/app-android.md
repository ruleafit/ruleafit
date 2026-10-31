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
