# Ruleafit — Contexto del proyecto

## Qué es
Marketplace de clases sueltas de entrenamiento (sin gimnasio ni cuota), en toda España (Sevilla es la ciudad principal). Dos perfiles: cliente y entrenador. Color de marca: lima #B5E600. Los textos de la interfaz no deben prometer solo entrenamiento al aire libre o en grupo, ni limitar el servicio a unas ciudades concretas (a futuro: gimnasios, sesiones individuales).

## Stack
Next.js 16.4 (App Router) + React 19 + Tailwind 4 + lucide-react. Supabase (PostgreSQL con RLS + RPCs en `sql/`). Pagos: TPV virtual Redsys/CyberPack (CaixaBank), firma HMAC_SHA256_V1. Email: Resend. Push: web-push. Hosting: Vercel (https://www.ruleafit.com, deploy automático al hacer push a main). Node 24.x.
- Repo privado: github.com/ruleafit/ruleafit. Supabase: proyecto "ruleafit", Irlanda.
- Claves en `.env.local` (ignorado por git; nunca leerlo ni imprimir valores).
- SEPA / pain.001 / liquidaciones a entrenadores: NO implementado todavía.

## Mapa de carpetas críticas
- `lib/pagos/dinero.ts` — comisión (bps) y reparto (`calcularReparto`). Única fuente TS de lógica financiera.
- `lib/pagos/redsys.ts` — firma y parámetros Redsys. `lib/pagos/validaciones.ts` — validaciones de pago.
- `app/api/payments/crear` — creación de cobro (el importe lo calcula la BD con `crear_cobro`).
- `app/api/payments/redsys-webhook` — verifica firma y llama a `confirmar_cobro_pagado`.
- `app/api/payments/perfil-fiscal` — datos fiscales del entrenador.
- `sql/071_pagos_tablas.sql`, `sql/072_pagos_funciones.sql` (comisión/cobros en BD), `sql/073_reservar_exige_pago.sql`.
- `lib/supabaseAdmin.js` — cliente service role; solo importable desde código de servidor.
- `lib/supabaseClient.js` — cliente público. Reservas: `components/BotonReservar.js`, `sql/001_reservas.sql`.
- `components/` modular por pantalla: `cuenta`, `publicar`, `clases`, `entrenador`, `home`, `mis-clases`, `mis-reservas`, `editar-clase`, `ruleros`. Cada `app/**/page.js` es solo un contenedor (<110 líneas): ve directo al subcomponente (`use*.js` = carga de datos, `Bloque*`/`Tarjeta*`/`Lista*` = UI). `BotonReservar.js` y `PerfilFiscal.js` se mantienen sin dividir a propósito (flujos de pago/fiscal).
- `components/MapaClases.js` + `components/mapa/*` + `lib/agruparMapa.js` — mapa de /clases: círculos numéricos y, en zoom máximo, una foto por organizador (`CapaMaximoZoom`). `MarkerClusterGroup` debe llevar `spiderfyOnMaxZoom={false}`; si no, las sesiones se dispersan sin ampliar el zoom.
- `sql/079`–`sql/086` — avisos de sesiones en mi zona, privacidad de participantes, bloqueos (cada uno con variantes de verificación/reversión).
- `docs/plan-pagos-fase-1.md`, `docs/auditoria-seguridad.md`, `docs/lanzamiento-avisos-zona.md` — plan, auditoría y guía de lanzamiento. Estado general: `PROGRESS.md`.

## Reglas estrictas
- Prohibido duplicar lógica financiera (comisión, reparto, importes) fuera de `lib/pagos/dinero.ts` y `sql/072_pagos_funciones.sql`. Si cambia una, verificar que la otra coincide.
- El importe nunca se confía al cliente: lo calcula la BD.
- No leer enteros archivos de más de 300 líneas: usar Grep o leer por rangos (`offset`/`limit`).
- Antes de cualquier commit que toque pagos: `npm run test:pagos` debe pasar.
- Antes de proponer un commit con cambios de código: `npm run build`.
- Las escrituras de reservas solo vía RPC (`reservar_clase`, `cancelar_reserva`, `cancelar_clase`), nunca insert/update directo desde el cliente.
- Cambios mínimos: no refactorizar lo que no se ha pedido tocar.

## Reglas de trabajo
- Modo manual: cada cambio se aprueba a mano. Pedir confirmación antes de tocar `.env.local`, borrar archivos, autenticación, instalar librerías, cambios destructivos en Supabase, commit/push y todo lo de pagos/reservas.
- Commits solo cuando se piden explícitamente.
- Tras un cambio visible: arrancar `npm run dev`, probarlo como usuario y revisar la consola. Si hace falta login, pedirlo; no inventar credenciales.

## Decisiones de producto (resumen)
- Sin lista de espera; zona horaria Europe/Madrid. Cancelación (sql/087): se puede cancelar hasta el comienzo de la sesión; con ≥ 2 h hay derecho a devolución (cobro pagado → `requiere_reembolso`), con < 2 h es tardía (`reservas.cancelacion_tardia`): sin devolución (el cobro sigue `pagado`) y la sesión de un bono queda consumida; la plaza se libera siempre. El aviso al usuario usa `lib/plazoCancelacion.js` (mismo cálculo que `cancelar_reserva`: cambiar ambos a la vez). Cancelaciones por organizador, mínimo de plazas y bloqueo tienen reglas propias (no son tardías).
- Rulos: puntos de fidelización (no dinero): 20 de bienvenida y 5 por asistencia confirmada (`marcar_asistencia()`). No se compran, retiran ni transfieren.
- Ciudad con autocompletado Nominatim (`lib/geocodificar.js`); `clases.provincia`; mapa Leaflet + OpenStreetMap.
- Clases con `plazas_min` opcional; el entrenador puede cancelar la clase entera (`cancelar_clase()`).
- Seguir (`seguimientos`, público) y Favoritos (`favoritos`, privado, `sql/078`) son independientes. Solo Favoritos alimenta el filtro "Usuarios favoritos" de /clases y las notificaciones de nuevas sesiones (preferencia `publicaciones`).
- Avisos de sesiones en mi zona: PUBLICADO y activo (`config_avisos_zona`: `inmediatos_activos` y `resumen_activo` = true; solo avisa a quien guarda y activa su zona; resumen diario 20:30 Madrid). Visible por `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` en Vercel Production. Parada de emergencia: `update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;`.
- «Quién participa» en el detalle de sesión: opt-in (@ oculto por defecto, «Usuario anónimo»); el organizador ve siempre todos los @ (`participantes_clase()`, `perfil_privacidad`).
- Bloqueos: si A bloquea a B, para B A no existe (RLS con `me_ha_bloqueado()`); al bloquear se cancelan las reservas futuras de B con A y los cobros pagados quedan en `requiere_reembolso`. **NO activar `config_pagos.pagos_activos` hasta implementar la devolución real por Redsys** (ver aviso en PROGRESS.md).
- Series de sesiones recurrentes (sql/088): `series_sesiones` + `clases.serie_id`; cada sesión es una sesión normal. Se crean/gestionan SOLO con `publicar_serie`, `cancelar_serie`, `editar_serie`, `actualizar_patron_serie` (usan `cancelar_clase`/`editar_clase`); el cliente no puede tocar `serie_id`. Máx. 250 sesiones por serie. UI: `components/series`, `components/publicar/*Serie*`, `components/mis-clases/*Serie*`; lógica de fechas en `lib/seriesSesiones.js` (el límite 250 debe coincidir con el SQL). Notificación agrupada para favoritos; la inserción de series se marca con `ruleafit.serie_rpc` (limitar_envios y notificar_publicacion_clase la respetan).
- «Añadir al calendario» (C02): `lib/calendario.js` genera el enlace de Google Calendar (URLSearchParams, `ctz=Europe/Madrid`) y el .ics (VTIMEZONE Madrid, escapado y plegado); `components/BotonCalendario.js` se usa tras reservar (solo detalle, `mostrarCalendario`) y en reservas futuras activas de Mis reservas. Sin sincronización ni permisos; el evento remite a la ficha para cambios/cancelaciones.
- Valoraciones y avisos (sql/089): C16 `solicitar_valoraciones()` (cron cada 10 min) pide valorar 1 h después de terminar la sesión a quien tiene asistencia confirmada (Rulos `asistencia_confirmada`), no ha valorado a ese organizador (1 valoración por usuario y organizador) y sin solicitud previa en 7 días; tabla `solicitudes_valoracion`, enlace `/entrenador/<usuario>?valorar=1`. C18 `enviar_aviso_participantes` (máx. 3 avisos y 300 caracteres por sesión, solo antes de empezar, solo el organizador, a reservas activas) con `reintentar_aviso`, `avisos_sesion_organizador/participante`; avisos inmutables. Usan `generar_notificacion` (categorías desactivables `solicitud_valoracion` y `avisos_organizador`: la preferencia solo apaga el push, la campana siempre conserva el aviso).
- Ubicaciones habituales (N09, sql/090): tabla privada `ubicaciones_habituales` (RLS por usuario, sin relación con `clases`: editar/borrar una nunca cambia sesiones). Solo se gestionan desde /publicar. Elegir una NO toca Zona (`clases.direccion`, opcional) ni Punto de encuentro. Ciudad: detección inversa desde el mapa (`lib/geocodificarInversa.js`, municipio no provincia, nunca pisa lo elegido a mano). TODAS las llamadas a Nominatim deben ir por `fetchNominatim` (`lib/nominatim.js`: cola ≥ 1,1 s, Referer, cancelación) con su caché.
- Filtros de Explora (N10): todo el filtrado vive en `components/clases/filtros.js` + `useClasesListado.js` (una sola lista `clasesFiltradas` para tarjetas y mapa). Precio: `precioRango` null = sin restricción (barra `SelectorRangoPrecio` 0–50 €, solo restringe si se mueve); duración por tramos (sin duración solo con «Cualquier duración»); `soloPlazasLibres`. Cualquier filtro nuevo debe añadirse ahí y a `limpiarFiltros`.
- Invitaciones (C25, sql/093): enlace `/invita/<código>` → `abrir_invitacion` emite un BILLETE de un solo uso (`invitaciones_abiertas`) que viaja con el registro (metadatos `invitacion` en el alta con correo; `reclamar_invitacion` en Google/callback). `aplicar_invitacion` (única vía, atómica e idempotente) solo premia cuentas creadas DESPUÉS de abrir el enlace: +20 Rulos extra al invitado (además de los 20 de bienvenida, que no cambian) y +20 al invitador, vía `otorgar_rulos`. Trigger `on_auth_user_invitacion` en auth.users BLINDADO (nunca rompe un alta). Tablas privadas sin historial visible. El enlace de perfil (`/entrenador/<usuario>`, ruta pública existente) NUNCA concede Rulos. `lib/invitacion.js` (billete, clave aparte) convive con `lib/retorno.js` (que ahora admite rutas de perfil con intención seguir/favorito). Pendiente de autorización: cron `invitaciones-recuperar` (`sql/093_invitaciones_cron.sql`).
- Avisos de plaza (C15, sql/092): `alertas_plaza` (por usuario y sesión, solo RPC `activar/desactivar_aviso_plaza`; RLS propia). Un constraint trigger DIFERIDO en `clases` detecta completa→disponible (estado final) y abre un episodio (`episodios_plaza`) que avisa a TODOS los interesados a la vez (campana + push, categoría `avisos_plazas`), idempotente por `avisos_plaza_enviados`; recuperación por cron. Los triggers están BLINDADOS (un fallo nunca rompe reservas/cancelaciones). Antispam: 60 s entre rondas y 6/hora por sesión (pueden omitir episodios legítimos). No modificar `generar_notificacion` sin conservar la rama `plaza_libre`. La cola push (`/api/procesar-notificaciones`) reclama cada notificación de forma atómica; el cron corre cada 10 s. Doble confirmación <30 min: `lib/ultimaHora.js` + `AvisoUltimaHora` (no cambiar el umbral sin tocar sus pruebas). `lib/retorno.js` guarda `intencion` (reservar|avisar).
- Agrupación en Explora (N11): `components/clases/agruparSesiones.js` agrupa por organizador+día la lista YA filtrada (después de TODOS los filtros, N10 incluidos) en `ListaClases`; el mapa sigue recibiendo `clasesFiltradas` completa y no se toca. Un filtro nuevo solo se añade en `filtros.js`/`useClasesListado.js`, nunca en la agrupación. `cargarClases` pagina de 1000 en 1000 (límite de PostgREST).
- Reserva exprés (C03): el visitante sin sesión que pulsa «Reservar» abre `PanelIdentificacion` (portal) → `/registro|login?volver=/clases/<id>`. El retorno vive en `lib/retorno.js` (SOLO `/clases/<uuid>`, localStorage, 6 h, sin credenciales; no ampliar la lista blanca sin revisar redirecciones abiertas). Tras identificarse nunca se reserva solo; `BotonReservar` muestra el aviso y borra el recuerdo. Campo `invitacion` reservado para C25 (hoy se descarta).
- Centros (N15, sql/091): `/centros` + formulario público → `/api/centros/solicitud` → tabla PRIVADA `solicitudes_centros` (solo service_role vía `registrar_solicitud_centro`; se gestiona desde Supabase; estados nuevo/contactado/demo_pendiente/registrado/activo a mano, nunca automáticos). Aviso por Resend a `CENTROS_ADMIN_EMAIL` o `FEEDBACK_ADMIN_EMAIL` (guarda primero; si el correo falla, queda guardada). Conservación: criterio de 12 meses sin relación comercial (sujeto a revisión jurídica). Validación compartida en `lib/centros/validarSolicitud.js`. `/registro?tipo=organizador` solo guarda interés (sin rol nuevo); guía de 3 pasos en `components/home/GuiaOrganizador.js`.
- Mi cuenta usa desplegables (`BloqueDesplegable`): Tu perfil, Estadísticas, Notificaciones, Avisos de zona, Últimas notificaciones, Mis últimos Rulos, Ruleros bloqueados; después Eliminar cuenta y Cerrar sesión.
- Perfiles: `public.perfiles` (username único 3-20 caracteres), creado por trigger en auth.users.
- Pendientes legales: revisión jurídica de 3 puntos de la política de privacidad (datos de localización, transferencias internacionales, etiquetas de privacidad de iOS).
- Detalle histórico de decisiones y fases: PROGRESS.md.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
