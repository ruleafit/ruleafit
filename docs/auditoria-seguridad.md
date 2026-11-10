# Auditoría de seguridad — 9 noviembre 2026

Alcance: rutas de la API, permisos y funciones de la base de datos (archivos `sql/`), secretos, dependencias,
cabeceras, service worker y XSS. Método: lectura del código y pruebas con la clave **pública** del navegador contra
producción, usando solo llamadas que fallan o no hacen nada antes de escribir. No se ha tocado `.env.local` ni Vercel.

## Hallazgos y estado

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| 1 | **Alta** | `otorgar_rulos(...)` ejecutable sin iniciar sesión: cualquiera con la clave pública podía darse Rulos sin límite (y subir de nivel). Confirmado en producción. | Arreglo en `sql/074` (**pendiente de ejecutar por el usuario**) |
| 2 | **Alta** | `generar_notificacion(...)` ejecutable sin iniciar sesión: se podían mandar notificaciones push y avisos a cualquier usuario con título, texto y enlace a elegir (phishing). Confirmado en producción (204). | Arreglo en `sql/074` (**pendiente**) |
| 3 | Media | Mismo problema en otras 7 funciones internas (`procesar_recordatorios`, `autocancelar_clases_sin_minimo`, `completar_asistencia_clases_pasadas`, `purgar_notificaciones_historial`, `otorgar_rulos_clase_completada`, `generar_username_desde_email`, `username_disponible_o_sufijo`). Solo hacen tareas de mantenimiento, pero no deben ser públicas. No se ejecutaron en la prueba. | Arreglo en `sql/074` (**pendiente**) |
| 4 | Media | El clic en una notificación abría cualquier enlace del aviso, también de otras webs. | Arreglado en `public/sw.js`: solo enlaces de la propia web |
| 5 | Media | Sin cabeceras de seguridad (clickjacking, tipo de contenido, referrer, permisos). | Arreglado en `next.config.mjs` (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, `object-src`, `base-uri`) |
| 6 | Baja | Las rutas llamadas por la base de datos comparaban `Bearer ${CRON_SECRET}` con `!==`: si la variable faltara, `Bearer undefined` entraría, y la comparación no es de tiempo constante. En producción la variable existe (comprobado: 401). | Arreglado: `lib/secretoCron.js` (falla cerrado + tiempo constante) |
| 7 | Baja | `avisar-feedback` fallaba con 500 ante un cuerpo mal formado. | Arreglado |
| 8 | Media (pendiente) | Un entrenador puede actualizar **cualquier columna** de sus propias sesiones por la API directa (`plazas_ocupadas`, `estado`, `precio`…), saltándose `editar_clase` y `cancelar_clase`. Con pagos activos importa más. | **Pendiente de decidir** (ver recomendaciones) |
| 9 | Baja | `rulos_saldos` legible por cualquier usuario con sesión; `perfiles`, `valoraciones` y `seguimientos` son públicos (por diseño). | Aceptado |

## Lo que está bien (comprobado)
- La clave de servicio (`supabaseAdmin`) solo se usa en rutas de servidor; ningún archivo de cliente la importa.
- Ningún secreto ni archivo `.env`/clave en git. `npm audit` de producción: 0 vulnerabilidades.
- RLS activado en todas las tablas. Las funciones de usuario exigen sesión (`auth.uid()`); `reservar_clase` y `eliminar_mi_cuenta` devuelven 403 sin sesión.
- Pagos: importe calculado en la base de datos, firma de Redsys verificada, confirmación idempotente, IBAN cifrado y no legible desde el navegador.
- Administración: token válido + correo confirmado + lista de administradores.
- Storage de avatares: cada usuario solo escribe en su carpeta.
- HSTS activo (Vercel). El único `dangerouslySetInnerHTML` con datos usa SVG generados por la propia web.

## Recomendaciones pendientes
1. **Ejecutar `sql/074_cerrar_funciones_internas.sql`** en el editor SQL de Supabase y volver a lanzar la sonda (debe dar 403 / permiso denegado).
2. Hallazgo 8: quitar el permiso de `update` directo sobre `clases` y dejar solo las columnas que la web edita, o añadir un trigger que bloquee cambios en `plazas_ocupadas`/`estado`/`precio` fuera de las funciones. Hacerlo **antes de activar pagos**.
3. Revisar en el panel de Supabase (no se puede ver desde el código): contraseña mínima y protección contra contraseñas filtradas, caducidad del OTP, lista de Redirect URLs sin comodines, límites de envío de correos, y que el bucket `avatares` limite tipo y tamaño de archivo.
4. Límite de peticiones (rate limiting) en el registro, el feedback y las denuncias.
5. Política `script-src` de CSP (hoy no se limita para no romper Next, Leaflet y el pago de Redsys): probar a fondo.
6. Antes de dinero real: revisión legal y una segunda auditoría centrada en pagos y `eliminar_mi_cuenta` (saldo, cobros, perfil fiscal).
