# Openfit — Progreso del proyecto

Última actualización: 12 julio 2026

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

## Fase 3 · Reservas — en curso
Hecho:
- Tabla reservas con RLS, índice único para evitar reservas duplicadas, y función RPC reservar_clase() con bloqueo de fila para evitar sobreventa (sql/001_reservas.sql, ejecutado en Supabase).
- Botón Reservar (components/BotonReservar.js) en tarjetas y ficha de detalle, con estados según sesión, rol, aforo, clase pasada/inactiva y reserva ya existente. Llama a la función RPC reservar_clase() y actualiza el contador de plazas al momento.
- Página /mis-reservas: lista de reservas activas del cliente ordenadas por fecha, restringida por rol, con enlace en el menú visible solo para clientes.

Falta:
- [ ] Panel del entrenador: ver quién se apuntó.
- [ ] Cancelación con umbral de 2h.

## Fase 4 · Cartera virtual (simulada) — pendiente
- [ ] Saldo por usuario.
- [ ] Recarga simulada.
- [ ] Descuento de saldo al reservar.
- [ ] Historial de movimientos.

## Fase 5 · Pulido y lanzamiento — pendiente
- [ ] Coherencia visual con la marca.
- [ ] Responsive (móvil).
- [ ] Mensajes de error claros.
- [ ] Pruebas con usuarios reales.
- [ ] Despliegue final en Vercel (producción).

## Fase 6 · Pagos reales con Stripe — futuro, fuera del MVP
- Sustituir la cartera simulada por pagos reales. Posterior al lanzamiento.
