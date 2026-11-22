# Borrador: cambios de la política de privacidad por «Avisos de sesiones en mi zona»

**NO PUBLICADO.** No modifica `legal/politica-privacidad.md` ni `app/privacidad/page.js`. Debe revisarlo el gestor o asesor jurídico y aprobarlo el titular antes de publicar, y **antes de activar la función en Producción**. No es asesoramiento legal. `[REVISAR: ...]` = punto a confirmar.

## 1. Qué trata la función (hechos comprobados en el código y la base de datos)
- Datos que el usuario introduce **voluntariamente** al activar los avisos (tabla `avisos_zona`, visible solo para él por RLS): nombre y **coordenadas de su zona habitual** (la que elige en el buscador de direcciones; no usa GPS ni el seguimiento continuo), radio (1/5/10/20 km), categorías, franja horaria de inicio y modalidad (inmediata o resumen diario).
- Funciona **desactivada por defecto**; el usuario la activa y la desactiva cuando quiera. Al desactivarla o eliminar la cuenta, la configuración se elimina con la cuenta (borrado en cascada). (Comprobado: `eliminar_mi_cuenta()` en `sql/068` borra el usuario de `auth.users` y las tablas de avisos lo referencian con `on delete cascade`.)
- La ubicación solo se compara en el servidor con la de las sesiones publicadas para decidir si avisar. **No se comparte con otros usuarios, entrenadores ni terceros**, y no se usa para publicidad ni perfiles comerciales.
- Datos derivados: avisos enviados (campana y notificación push), resumen diario con la lista de sesiones incluidas y registros técnicos de control para evitar duplicados.
- Las notificaciones push pasan por los servicios de entrega del navegador o sistema (Google, Apple, Mozilla) mediante la suscripción que el usuario ya concede al activar las notificaciones. El contenido es el título de la sesión, ciudad, fecha y hora y el nombre público del organizador.

## 2. Texto propuesto (añadir/modificar en la política)

**Categorías de datos personales** — sustituir «únicamente datos identificativos» por:
> Se tratan datos identificativos (correo electrónico, contraseña cifrada, nombre de usuario público, tipo de perfil y registro de clases publicadas o reservadas) y, **solo si el Usuario activa «Avisos de sesiones en mi zona»**, su zona habitual (nombre y coordenadas aproximadas del lugar que él elige), el radio, las categorías y la franja horaria preferidos y la modalidad de aviso.

**Fines del tratamiento** — añadir:
> Si el Usuario activa «Avisos de sesiones en mi zona», Ruleafit utiliza su zona habitual y sus preferencias exclusivamente para avisarle, por la campana de la aplicación y, si ha permitido las notificaciones, por notificación push, de nuevas sesiones publicadas cerca de él (de forma inmediata o en un resumen diario a las 20:30, hora de España peninsular). No se utilizan con fines publicitarios ni se comparten con otros usuarios o terceros.

**Base legal** — añadir:
> El tratamiento de la zona habitual y las preferencias de aviso se basa en el consentimiento del Usuario, que se otorga al activar esta función y se retira en cualquier momento desde Mi cuenta → Notificaciones, sin afectar al resto del servicio.

**Períodos de retención** — añadir:
> La zona y las preferencias se conservan mientras la función esté activada y la cuenta exista; se eliminan al eliminar la cuenta. Los avisos de zona del historial de notificaciones se limitan a los 5 más recientes por usuario; los registros técnicos de control se eliminan automáticamente a los 14-90 días según su tipo y los resúmenes diarios a los 60 días. `[REVISAR: confirmar plazos antes de activar la limpieza (sql/083)]`.

**Destinatarios** — añadir:
> Para entregar notificaciones push se utilizan los servicios de mensajería del navegador o del sistema operativo del Usuario (Google, Apple, Mozilla u otros), que reciben el contenido de la notificación y un identificador técnico del dispositivo. `[REVISAR: transferencias internacionales]`.

## 3. Otros puntos
- Actualizar la fecha de «Última actualización» al publicar.
- `legal/borradores/cambios-privacidad-y-aviso-legal.md` ya lista cambios por pagos; integrar este borrador en el mismo paquete de revisión.
- Si Apple exige etiquetas de privacidad en la app de iPhone: añadir «Ubicación aproximada, no vinculada a seguimiento» `[REVISAR]`.
- El texto de la pantalla de configuración ya explica qué se guarda; revisar que coincida con esta política.
