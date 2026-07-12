# Openfit — Contexto del proyecto

## Qué es
Marketplace de entrenamientos deportivos al aire libre, clases sueltas (sin gimnasio ni cuota), en Sevilla (principal) y Málaga. Dos perfiles: cliente y entrenador. Color de marca: lima #B5E600.

## Stack
Next.js 16 + React 19 + Tailwind + Supabase + Vercel. Stripe más adelante (fuera del MVP).

## Estructura y cuentas
- Proyecto en C:\proyectos\openfit.
- Repo privado: github.com/openfit2026/openfit.
- Supabase: proyecto "openfit", región Europa (Irlanda).
- Conector Supabase en lib/supabaseClient.js; claves en .env.local (no se sube a git, protegido por .gitignore).

## Decisiones de producto (MVP)
- Sin lista de espera: clase llena = botón de reservar desactivado.
- Cancelación con umbral de 2h: gratis antes, sin devolución después.
- Cartera virtual simulada (recargas ficticias, sin Stripe todavía).
- Ubicación: mapa real (Leaflet + OpenStreetMap) + dirección libre + punto de encuentro.
- Modalidad: texto libre escrito por el entrenador (se muestra al cliente) + categoría general para filtros. Categorías: Fuerza / funcional, Baile / coreografiado, Yoga / movilidad, Cardio / running, Combate / boxeo, Otra.

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

## Estado actual
Ver PROGRESS.md para saber qué fases y bloques están completados y cuáles faltan.
