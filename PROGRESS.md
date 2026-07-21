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

Pendiente para no perder de vista:
- [ ] Activar 2FA en la cuenta de Vercel antes de invitar a la beta.
- [ ] Reactivar la confirmación de email en Supabase antes del lanzamiento real.
- [ ] Valorar fijar la versión de Node con "engines" en package.json.

Falta de Fase 5 (parte 1, antes de la beta):
- [ ] Responsive (móvil).
- [ ] Coherencia visual con la marca.

Falta de Fase 5 (parte 2, tras el feedback de la beta):
- [ ] Mensajes de error claros.
- [ ] Pulido fino según feedback de usuarios reales.

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
