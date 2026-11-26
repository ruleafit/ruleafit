# Segunda auditoría de seguridad (pagos y eliminar cuenta) — 26 noviembre 2026

Alcance: tablas, funciones y rutas de pagos (sql/071-073, app/api/payments/*) y `eliminar_mi_cuenta`.
Método: lectura del código y consultas SOLO de lectura a producción (permisos, RLS, avisos de Supabase). Pagos apagados
(`pagos_activos=false`, 0 cobros). Estado: preparada para repetirse justo antes de activar dinero real.

## Hallazgos
| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Alta (al activar pagos) | `eliminar_mi_cuenta` fallaba o dejaba dinero huérfano con datos de pagos (FK `restrict`, saldo, cobros pendientes). | Arreglo en `sql/095` + texto de `EliminarCuenta.js`. **Pendiente de ejecutar en Supabase** (producción sigue con la función antigua). |
| 2 | Media | `/api/payments/perfil-fiscal` no comprobaba `PAGOS_ACTIVOS`: con pagos apagados cualquiera con sesión puede guardar NIF/IBAN. | Corregido en código (503 con pagos apagados); pendiente de commit y despliegue. |
| 3 | Media | `anon` puede ejecutar `eliminar_mi_cuenta` y otras RPC de usuario (fallan sin sesión por `auth.uid()`). | La 095 revoca `anon` en `eliminar_mi_cuenta`; revisar el resto (reservar_clase, cancelar_*, editar_*) con el mismo criterio. |
| 4 | Media | Cobros pagados en `requiere_reembolso` sin devolución real. | En curso en el hilo de devoluciones (sql/096). Pagos NO se activan hasta tenerlo. |
| 5 | Baja | `pagos_tocar_updated_at` y `movimientos_bolsa_solo_insertar` sin `search_path` fijo. | Preparado en `sql/097_endurecer_pagos.sql` (pendiente de ejecutar). |
| 6 | Baja | Protección contra contraseñas filtradas desactivada en Supabase Auth. | Abierto (ajuste de panel, plan Pro). |
| 7 | Info | 22 tablas con RLS y sin políticas: intencional (solo service_role/funciones), incluido `config_pagos`, `liquidaciones`. | Aceptado |

## Comprobado y correcto
- Las 7 tablas de pagos tienen RLS y ni `anon` ni `authenticated` pueden insertar, actualizar ni borrar; `anon` no lee.
- `crear_cobro` solo ejecutable por usuarios con sesión; `confirmar_cobro_pagado`, `guardar_perfil_fiscal` y `liberar_pendientes` solo service_role.
- Importe calculado en la BD; webhook con firma en tiempo constante, importe contrastado e idempotente.

## Pruebas obligatorias antes de activar pagos
1. Cobro completo en el entorno de pruebas de Redsys (OK, rechazado, cancelado, sesión llena al pagar).
2. Borrar cuenta de prueba con: cobro pendiente, saldo, sesión pagada futura (debe rechazar) y sin nada (debe borrar y archivar el perfil fiscal).
3. Repetir la sonda con la clave pública sobre todas las funciones de pagos.
4. Revisión del asesor: plazo de conservación (referencia 6 años), campos archivados y textos legales.
