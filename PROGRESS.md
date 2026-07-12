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

## Fase 2 · Clases — en curso
Hecho:
- Tabla clases en Supabase con RLS.
- /publicar: formulario con mapa real (Leaflet) para lat/lng.
- /clases: listado en tarjetas (dirección, punto de encuentro, coordenadas).
- Restricción "solo entrenadores publican" (interfaz + política RLS).
- Menú de navegación (roles, indicador animado bajo enlace activo, botones de acción).
- Detalles estéticos: formulario de /publicar centrado por secciones, tarjetas de /clases con indicador de plazas libres.

Falta:
- [ ] Filtros en /clases (ciudad, categoría).
- [ ] Ficha de detalle de cada clase.
- [ ] Mapa en /clases con todas las clases + filtros de fecha/franja horaria (marcador por clase, popup resumen, ocultar canceladas/pasadas).

## Fase 3 · Reservas — pendiente
- [ ] Botón reservar + aumento de plazas_ocupadas.
- [ ] Desactivar botón si la clase está llena (sin lista de espera).
- [ ] "Mis reservas" para el cliente.
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
