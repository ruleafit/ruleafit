# Openfit — Progreso del proyecto

Última actualización: 21 julio 2026

## Fase 0 · Entorno base — completada
- Node, VS Code y Git instalados.
- Proyecto Next.js creado y subido a GitHub.

## Fase 1 · Cuentas y sesión — completada
- Registro real con Supabase (app/registro).
- Login (app/login).
- Página /cuenta: ver usuario/rol y cerrar sesión.
- Roles cliente/entrenador guardados en user_metadata.rol.
- Confirmación de email desactivada (solo desarrollo).
- Conector lib/supabaseClient.js, claves en .env.local.
- Home personalizada con botones a login/registro.

## Fase 2 · Clases — completada
Hecho:
- Tabla clases en Supabase con RLS.
- /publicar: formulario con mapa real (Leaflet) para lat/lng.
- /clases: listado en tarjetas (dirección, punto de encuentro, coordenadas).
- Restricción "solo entrenadores publican" (interfaz + política RLS).
- Menú de navegación (roles, indicador animado bajo enlace activo, botones de acción).
- Detalles estéticos: formulario de /publicar centrado por secciones, tarjetas de /clases con indicador de plazas libres.
- Filtros en /clases: por ciudad y categoría, aplicados al instante, con mensaje de estado vacío.
- Ficha de detalle de cada clase (/clases/[id]) con mapa de solo lectura, gestión de clase no encontrada y enlace "Ver detalle" en las tarjetas.
- Mapa en /clases con marcador por clase y popup resumen, filtros de ciudad/categoría/cuándo (hoy, mañana, próximos 7 y 30 días)/franja horaria, exclusión permanente de clases canceladas o con fecha pasada.

Falta:
- Ninguno.

## Fase 3 · Reservas — completada
Hecho:
- Tabla reservas con RLS, índice único para evitar reservas duplicadas, y función RPC reservar_clase() con bloqueo de fila para evitar sobreventa (sql/001_reservas.sql, ejecutado en Supabase).
- Botón Reservar (components/BotonReservar.js) en tarjetas y ficha de detalle, con estados según sesión, rol, aforo, clase pasada/inactiva y reserva ya existente. Llama a la función RPC reservar_clase() y actualiza el contador de plazas al momento.
- Página /mis-reservas: lista de reservas activas del cliente ordenadas por fecha, restringida por rol, con enlace en el menú visible solo para clientes.
- Panel del entrenador (/mis-alumnos): función RPC segura reservas_de_mis_clases() y página que agrupa las reservas por clase, con email y fecha de reserva de cada cliente.
- Cancelación de reservas (/mis-reservas): función RPC segura cancelar_reserva(), botón con confirmación, mensaje informativo según si quedaban 2h o más (sin cargo real todavía, pendiente de la cartera en Fase 4).

Falta:
- Ninguno.

## Nombres de usuario (previo a Fase 4)
Hecho:
- Tabla perfiles con generación automática al registrarse (trigger), backfill de cuentas existentes, comprobación de disponibilidad antes de registrarse o cambiar de nombre (username_disponible), campo de nombre de usuario en /registro, edición desde /cuenta, y panel del entrenador (Mis alumnos) mostrando nombre de usuario en vez de email por privacidad.

## Fase 4 · Open (puntos de fidelización) — completada
Hecho:
- Sistema de Open completo: tablas open_saldos/open_movimientos/open_motivos con RLS, bienvenida automática (20 Open) al registrarse, asistencia confirmada (5 Open) marcada por el entrenador vía marcar_asistencia() con corrección mediante movimiento compensatorio, saldo e historial visibles en /cuenta, botones de asistencia en /mis-alumnos.

Falta:
- Ninguno.

## Mínimo de plazas y cancelación de clase (post Fase 4)
Hecho:
- Campo plazas_min en /publicar y aviso visual de "pendiente de confirmación" en tarjetas/ficha.
- Botón "Cancelar esta clase" para el entrenador en /mis-alumnos (función cancelar_clase, cancela la clase y todas sus reservas activas).
- Aviso claro en /mis-reservas cuando una reserva fue cancelada por el entrenador (cancelada_por_entrenador), en sección separada.
- Corregido un bucle de recursión en las políticas RLS de clases/reservas surgido al implementar esto (sql/010_arreglo_recursion_rls.sql).

## Pantalla de inicio tras login/registro (post Fase 4)
Hecho:
- Home (/) muestra botones grandes con iconos según rol (entrenador: Clases/Mis alumnos/Publicar/Mi cuenta; cliente: Clases/Mis reservas/Mi cuenta) cuando hay sesión iniciada.
- Login y registro redirigen automáticamente a esta pantalla.
- Enlace "Inicio" añadido al menú de navegación.

## Fase 5 · Pulido y lanzamiento — en curso
Hecho:
- Despliegue en Vercel: producción en https://openfit-five.vercel.app.
- Variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY configuradas en Vercel (valores no documentados aquí).
- En Supabase se añadieron el Site URL y las Redirect URLs de producción, manteniendo también las de localhost.
- Corregido el título de la pestaña del navegador ("Create Next App" → "Openfit").
- Rediseño visual completo, responsive desde el principio:
  - Base visual compartida: paleta de marca en app/globals.css, tipografía de titulares, y animaciones (aparición al hacer scroll vía IntersectionObserver en components/RevelarAlLlegar.js, hover de tarjetas que se elevan, zoom lento de imágenes), todo respetando prefers-reduced-motion.
  - Portada (/) rehecha: hero a pantalla casi completa con parallax suave, franja de categorías, franja de comunidad y sección de tres puntos con iconos.
  - /clases rediseñada: cabecera con imagen de fondo, filtros en píldora con acento lima, tarjetas con imagen según categoría, estado vacío con icono y botón para limpiar filtros.
  - /mis-reservas rediseñada: cabecera propia, imagen por categoría en cada tarjeta, franja de color en el borde izquierdo según estado (próxima en lima, ya pasada en gris, cancelada por el entrenador en rojo suave) y etiqueta de cuenta atrás ("faltan N días" / "es mañana" / "es hoy").
  - /cuenta rediseñada: cabecera con imagen desenfocada, saldo de Open destacado en tarjeta propia justo debajo de la cabecera, historial de movimientos con el nuevo estilo.
- Categorías de clase reducidas de seis a cuatro (Fuerza / funcional, Cardio, Yoga / Pilates / movilidad, Otros); los datos de las clases existentes se migraron manualmente en Supabase con UPDATE. El mapa de imagen por categoría vive en lib/imagenesCategoria.js, compartido entre /clases y /mis-reservas.
- Imágenes del proyecto en public/imagenes (portada, fuerza, running, yoga, combate, comunidad), descargadas de Pexels con licencia gratuita de uso comercial.
- Giro estratégico de mensajes: los textos ya no prometen exclusivamente entrenamiento al aire libre ni en grupo, de cara a abrirse en el futuro a gimnasios y a entrenamientos individuales o en pareja.

Pendiente (en orden):
1. **PRIORITARIO.** Captación de entrenadores en la portada sin sesión. Hoy la portada solo habla a los clientes, y un entrenador que llega por primera vez no encuentra ninguna razón para registrarse. Decisión tomada: NO dividir el hero en dos columnas (obligaría a elegir bando sin contexto y restaría impacto). En su lugar: mantener el hero único con el mensaje de cliente, y añadir más abajo una sección propia para entrenadores, visualmente diferenciada con fondo oscuro, con el titular "Tú pones las reglas", el cuerpo "Decides qué días trabajas, a qué hora, cuánta gente entra y cuánto cobras. Sin horario fijo, sin jefe. Publicas tu clase en dos minutos y cobras directamente a tus alumnos.", tres puntos de apoyo ("Tu horario, tus normas", "Tú fijas el precio y las plazas", "Cobras directo, sin intermediarios") y un botón que lleve al registro. Añadir además un enlace discreto "¿Eres entrenador?" en el menú de navegación que haga scroll hasta esa sección.
   Nota: no prometer ganancias concretas ni "sin comisiones" para siempre, porque con Stripe habrá comisión. Hablar de control, no de sueldo.
2. Diferenciar la portada con sesión de la portada sin sesión: sin sesión el objetivo es convencer, con sesión el objetivo es dar acceso rápido, por lo que el hero puede ser más corto cuando hay sesión iniciada.
3. Lado del entrenador: rediseño de /publicar y /mis-alumnos, con los mismos mensajes de "tú pones las reglas".
4. Ficha de detalle de clase (/clases/[id]).
5. /login y /registro.
6. Advertencia de mayoría de edad en el registro, para que coincida con lo que exige el aviso legal.
7. Actualizar el aviso legal (legal/aviso-legal.md y app/aviso-legal/page.js), que todavía describe el servicio como "sesiones de entrenamiento al aire libre".
8. Activar 2FA en la cuenta de Vercel antes de repartir el enlace de la beta.
9. Reactivar la confirmación de email en Supabase antes del lanzamiento real.

Otros pendientes menores (sin prioridad asignada):
- Valorar fijar la versión de Node con "engines" en package.json.
- Mensajes de error más claros en general, y pulido fino según el feedback de la beta.

## Fase 6 · Pagos reales con Stripe — futuro, fuera del MVP
- Sustituir la cartera simulada por pagos reales. Posterior al lanzamiento.

## Análisis de competencia (21 julio 2026)

Competidor directo detectado: Trainity (trainityapp.com), lanzado en julio de 2026. Misma propuesta que Openfit: entrenamientos en grupo al aire libre en Sevilla, sin cuotas mensuales, precios desde 3 €.

Sus ventajas sobre Openfit:
- Pagos reales con Stripe (tarjeta, Apple Pay, Google Pay). Cobran al cliente, abonan al entrenador y se quedan una comisión de intermediación.
- Documentación legal completa: aviso legal, condiciones de contratación, condiciones para entrenadores, privacidad, cookies, consentimiento informado de riesgo, titular identificado con NIF.
- SEO trabajado, con páginas específicas por búsqueda (entrenador personal en Sevilla, entrenamiento al aire libre, funcional, en grupo, para perder peso).
- Sistema de valoraciones y reseñas, limitado a quienes reservaron por la plataforma.
- Reserva sin registro: solo nombre, email y teléfono.
- Sección de perfiles de entrenador.

Sus debilidades frente a Openfit:
- No tienen panel de entrenador: el alta se hace por un formulario externo de Google, y el entrenador no puede publicar ni gestionar sus sesiones.
- La cancelación es manual (formulario o email), no automática.
- Sin cuentas de usuario, por lo que el cliente no tiene historial ni "mis reservas".
- Solo operan en Sevilla.
- Sin sistema de fidelización.
- Cancelación más rígida: 24 h de antelación frente a las 2 h de Openfit.

Conclusiones para la hoja de ruta:
- La ventaja diferencial de Openfit es el panel del entrenador (publicar, ver alumnos, marcar asistencia, cancelar clase). Conviene reforzarla para captar entrenadores.
- Subir la prioridad de los pagos reales (Fase 6): dejan de ser un extra posterior al lanzamiento para ser la diferencia entre producto y demostración.
- Valorar añadir a la hoja de ruta perfiles públicos de entrenador y valoraciones tras la clase. No dependen de Stripe y son clave para la confianza en un marketplace.
- Antes de cobrar dinero habrá que preparar la documentación legal correspondiente, con asesoramiento profesional.
