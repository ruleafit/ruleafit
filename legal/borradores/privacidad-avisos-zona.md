# Texto propuesto de la política de privacidad por «Avisos de sesiones en mi zona»

**PENDIENTE DE APROBACIÓN. NO PUBLICADO.** No modifica `legal/politica-privacidad.md` ni `app/privacidad/page.js`. No es asesoramiento legal: conviene que lo revise el gestor o asesor antes del lanzamiento. Actualizado el 22-nov-2026.

## Hechos que describe (comprobados en el código y la base de datos)
- La función está **desactivada por defecto** y la activa el propio usuario.
- Guarda, solo para él (acceso restringido por RLS): nombre y coordenadas de la **zona habitual que él elige** en el buscador de direcciones (no usa GPS ni seguimiento), radio (1, 5, 10 o 20 km), categorías, franja horaria y modalidad.
- La ubicación solo se compara en el servidor con la de las sesiones publicadas; no se comparte con otros usuarios, entrenadores ni terceros, ni se usa para publicidad o perfiles comerciales.
- Genera avisos en la campana y, si hay permiso, notificaciones push (título, ciudad, fecha, hora de la sesión y nombre público del organizador) y un resumen diario con las sesiones incluidas.
- Al eliminar la cuenta se borran en cascada la configuración, los resúmenes y las notificaciones (`eliminar_mi_cuenta()`, `sql/068`).
- Retención técnica: avisos de zona en la campana, los 5 más recientes por usuario; registros de control, entre 14 y 90 días; resúmenes diarios, 60 días; cola de envío de avisos de zona, 14 días.

## Cambios propuestos en el texto

**1. Categorías de datos personales** — sustituir el primer párrafo por:
> Las categorías de datos que se tratan en Ruleafit son: datos identificativos (dirección de correo electrónico, contraseña almacenada de forma cifrada, nombre de usuario público, tipo de perfil y registro de las clases publicadas o reservadas por el Usuario) y, únicamente si el Usuario activa la función «Avisos de sesiones en mi zona», la zona habitual que él mismo elige (su nombre y coordenadas aproximadas), el radio, las categorías deportivas y la franja horaria preferidos y la modalidad de aviso elegida (inmediata o resumen diario). Ruleafit no accede a la ubicación del dispositivo del Usuario para esta función.

**2. Fines del tratamiento** — añadir al final del apartado de fines concretos:
> Si el Usuario activa «Avisos de sesiones en mi zona», Ruleafit utiliza su zona habitual y sus preferencias exclusivamente para avisarle, en la campana de la aplicación y, si ha permitido las notificaciones, mediante notificación push, de las nuevas sesiones publicadas cerca de él, ya sea de forma inmediata o en un resumen diario a las 20:30 (hora de España peninsular). Estos datos no se utilizan con fines publicitarios ni se muestran a otros usuarios o a los entrenadores.

**3. Base legal** — añadir:
> El tratamiento de la zona habitual y de las preferencias de aviso se basa en el consentimiento del Usuario, que se otorga al activar «Avisos de sesiones en mi zona» y puede retirarse en cualquier momento desactivándola en Mi cuenta, sin que ello afecte al resto del servicio.

**4. Períodos de retención** — añadir:
> La zona habitual y las preferencias de aviso se conservan mientras el Usuario mantenga la función activada y su cuenta abierta, y se eliminan al eliminar la cuenta. Los avisos recibidos se conservan en el historial de notificaciones de forma limitada (los más recientes) y los registros técnicos asociados a su envío se eliminan automáticamente en un plazo máximo de 90 días.

**5. Destinatarios** — añadir:
> Para entregar las notificaciones push se utilizan los servicios de mensajería del navegador o del sistema operativo del dispositivo del Usuario (como Google o Apple), que reciben el contenido de la notificación y un identificador técnico del dispositivo.

**6.** Actualizar la fecha de «Última actualización» al publicar.

## Para el asesor `[REVISAR]`
- Si la «zona habitual» (barrio o dirección elegida, no el domicilio exacto) debe tratarse como dato de localización con información reforzada.
- Transferencias internacionales de los servicios push (Google/Apple).
- Etiquetas de privacidad de la app de iPhone («ubicación aproximada, no vinculada al usuario»).
