# Openfit — Contexto del proyecto

## Qué es
Marketplace de clases sueltas de entrenamiento (sin gimnasio ni cuota), en Sevilla (principal) y Málaga. Dos perfiles: cliente y entrenador. Color de marca: lima #B5E600.

Visión a futuro (no implementada todavía, solo de referencia): Openfit contempla abrirse más adelante a gimnasios y a entrenamientos individuales o en pareja, además de al aire libre y en grupo. Por eso, los textos de la interfaz no deben prometer exclusivamente entrenamiento al aire libre ni en grupo.

## Stack
Next.js 16 + React 19 + Tailwind + Supabase + Vercel. lucide-react para iconos. Stripe más adelante (fuera del MVP).

## Estructura y cuentas
- Proyecto en C:\proyectos\openfit.
- Repo privado: github.com/openfit2026/openfit.
- Supabase: proyecto "openfit", región Europa (Irlanda).
- Conector Supabase en lib/supabaseClient.js; claves en .env.local (no se sube a git, protegido por .gitignore).
- Desplegado en Vercel en https://openfit-five.vercel.app, con despliegue automático al hacer push a la rama main.

## Decisiones de producto (MVP)
- Sin lista de espera: clase llena = botón de reservar desactivado.
- Cancelación con umbral de 2h: gratis antes, sin devolución después.
- Moneda "Open" (puntos de fidelización, no es una cartera de dinero):
  - MVP: los Open se ganan mediante retos, promociones, bienvenida o asistencia confirmada; implementado hasta ahora: bienvenida automática de 20 Open al registrarse, y asistencia confirmada de 5 Open por clase, concedida (y corregible mediante movimiento compensatorio) por el entrenador vía marcar_asistencia(); retos y promociones quedan fuera de esta fase. No se pueden comprar, recargar con dinero, retirar ni transferir; no se usan para reservar ni pagar clases. Las clases se siguen pagando directamente al entrenador, fuera de la app. Sin recargas simuladas ni descuentos de Open al reservar.
  - Visión futura (no implementado todavía, solo de referencia): cuando Openfit integre pagos reales, el usuario podrá recargar dinero y convertirlo en Open (equivalencia inicial de referencia 1€ = 10 Open, revisable); a partir de entonces los Open podrán usarse para reservar clases dentro de la app. Antes de esa fase habrá que definir cómo se compensa al entrenador cuando se usen Open ganados gratuitamente, y revisar requisitos legales y técnicos.
- Ubicación: mapa real (Leaflet + OpenStreetMap) + dirección libre + punto de encuentro.
- Modalidad: texto libre escrito por el entrenador (se muestra al cliente) + categoría general para filtros. Categorías: Fuerza / funcional, Cardio, Yoga / Pilates / movilidad, Otros.
- Las clases pueden tener un mínimo de plazas (plazas_min) opcional; por debajo del mínimo se muestra un aviso de "pendiente de confirmación". El entrenador puede cancelar una clase entera (cancelar_clase()), lo que cancela también todas sus reservas activas y las marca con cancelada_por_entrenador = true, para que el cliente vea un aviso claro en /mis-reservas en vez de que la reserva desaparezca sin explicación.
- Tras iniciar sesión o registrarse, la app lleva a una pantalla de inicio (/) con botones grandes según el rol del usuario, en vez de dejar al usuario en la pantalla de login/registro.

## Reglas de trabajo en este proyecto
- Trabajo en "manual mode on": cada cambio se aprueba a mano (nunca "allow all" salvo bloque acotado).
- Frenos que requieren confirmación explícita antes de tocar: .env.local, borrado de archivos, cambios en autenticación, instalar librerías nuevas, cambios destructivos en Supabase, commit/push, y cualquier cosa relacionada con pagos/Stripe/cartera/reservas.
- Los commits se redactan y ejecutan solo cuando se pide explícitamente ("haz commit"), y tras aprobación.
- No arrancar el servidor de desarrollo (npm run dev), eso se hace manualmente aparte. npm run build sí se puede usar para verificar.
- Cambios mínimos: no refactorizar código que no se ha pedido tocar.

## Base de datos: reservas
- La tabla public.reservas existe con RLS activo.
- Las escrituras solo se hacen a través de la función reservar_clase(p_clase_id uuid) (nunca insert/update directo desde el cliente).
- El criterio de "clase pasada" es fecha+hora exacta en zona horaria Europe/Madrid.
- La función reservas_de_mis_clases() (sql/002_panel_entrenador.sql) permite al entrenador autenticado ver, de forma segura, las reservas activas de sus propias clases (incluye email del cliente), sin acceso a clases de otros entrenadores.
- La función cancelar_reserva(p_reserva_id uuid) (sql/003_cancelaciones.sql) permite al cliente cancelar su propia reserva si la clase no ha pasado, calcula si quedaban 2h o más (reembolso_aplicable) para uso futuro de la cartera, y de momento no aplica ningún cargo o devolución real.

## Base de datos: perfiles y nombres de usuario
- Existe la tabla public.perfiles (username público, 3-20 caracteres, formato letras ASCII/números/guion bajo, único sin distinguir mayúsculas/minúsculas).
- Se crea automáticamente al registrarse mediante un trigger en auth.users.
- Hay una función username_disponible(p_username) de solo lectura, accesible sin sesión, para comprobar disponibilidad antes de registrarse o al cambiar de nombre.
- reservas_de_mis_clases() ahora devuelve cliente_username en vez de cliente_email.

## Estado actual
Ver PROGRESS.md para saber qué fases y bloques están completados y cuáles faltan.
