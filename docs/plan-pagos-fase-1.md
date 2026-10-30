# Plan de la fase 1 de pagos (30 octubre 2026)

Estado: PLAN, sin código todavía. Aprobado por el usuario: tocar pagos, usar TypeScript en este módulo y añadir `pdfkit` (la fase 2 lo usa). Valores confirmados: comisión 10 %, mínimo de liquidación 10 €, 48 h hasta que el dinero esté disponible, 15 días de aceptación tácita de cada autofactura.

Todo queda detrás de un **interruptor apagado** (`PAGOS_ACTIVOS=false` y un campo en la base de datos): la beta actual no cambia.

## 1. Reglas de diseño
- Importes **siempre en céntimos enteros**. Reparto: comisión = redondeo(importe × 10 %), neto = importe − comisión.
- Todo lo que mueve dinero se hace **dentro de funciones SQL atómicas** (una transacción), nunca en el navegador.
- El webhook es **idempotente**: si el banco lo envía dos veces, no se abona dos veces (clave única por pedido).
- **Ruleafit no ve datos de tarjeta**: se pagan en la página de CaixaBank (Redsys).
- Los datos fiscales y el IBAN van en una tabla aparte, con acceso restringido y el IBAN cifrado.
- Escritura solo por funciones o clave de servicio; los usuarios solo leen lo suyo.
- Módulo en **TypeScript** (`lib/pagos/`); el resto del proyecto sigue en JavaScript.

## 2. Base de datos (migraciones sql/071 y sql/072, las ejecutas tú)

**sql/071 — tablas y permisos**
| Tabla | Para qué | Quién lee |
|---|---|---|
| `config_pagos` | Una fila: comisión (1000 = 10 %), mínimo 1000 céntimos, horas de liberación 48, días de aceptación 15, `pagos_activos` | Servicio |
| `perfiles_fiscales` | Tipo, nombre fiscal, NIF, domicilio, zona fiscal, correo de facturas, IBAN cifrado + últimos 4, titular, fecha de nacimiento, retención reducida, aceptaciones (versión, fecha, IP), estado (`incompleto`, `pendiente_revision`, `activo`, `bloqueado`) | El propio usuario (sin IBAN completo) |
| `cobros` | Un cobro de un alumno: clase, alumno, entrenador, importe, comisión, neto, método, estado, pedido Redsys único, código de autorización | Alumno y entrenador (lo suyo) |
| `bolsas` | Saldo `pendiente` y `disponible` de cada entrenador | El propio entrenador |
| `movimientos_bolsa` | Registro que solo se añade: abonos, liberaciones, reembolsos, liquidaciones, ajustes | El propio entrenador |
| `liquidaciones` y `liquidaciones_lineas` | Cierres de los días 15 y último, y la línea de cada entrenador | Servicio (y su línea al entrenador) |

El IBAN se cifra con `pgcrypto` usando una clave guardada en **Supabase Vault**, nunca en el código. La zona fiscal se propone a partir de la provincia de la sesión y se revisa a mano en Canarias, Ceuta y Melilla.

**sql/072 — funciones**
- `guardar_perfil_fiscal(...)`: valida y guarda los datos y las casillas de responsabilidad.
- `crear_cobro(clase_id)`: comprueba lo mismo que `reservar_clase` (plazas, no tu sesión, no bloqueado, no reservada) y crea el cobro pendiente con su reparto.
- `confirmar_cobro_pagado(pedido, ...)`: solo la clave de servicio. Idempotente. En una transacción: marca pagado, crea la reserva, suma la plaza y abona el neto a la bolsa como **pendiente**. Si la plaza ya no existe, marca `requiere_reembolso`.
- `liberar_pendientes()`: cada 15 minutos (`pg_cron`) pasa de pendiente a disponible los cobros cuya sesión terminó hace 48 h o más.
- Los cierres de periodo y las autofacturas llegan en la fase 2.

## 3. Código (TypeScript en `lib/pagos/` y rutas)
| Archivo | Función |
|---|---|
| `dinero.ts` | Euros a céntimos y cálculo del reparto |
| `validaciones.ts` | NIF, NIE y CIF (con su letra o dígito de control), IBAN (mod 97), código postal y que coincida con la provincia |
| `redsys.ts` | Parámetros del comercio (base64) y firma HMAC-SHA256 con la clave derivada del pedido (3DES), concepto "RULEAFIT", y verificación de la firma del banco con comparación segura |
| `app/api/payments/crear` | Usuario con sesión; llama a `crear_cobro` y devuelve el formulario firmado para ir al banco |
| `app/api/payments/redsys-webhook` | Recibe el aviso del banco, **valida la firma**, lee el código de respuesta y llama a `confirmar_cobro_pagado` |
| `app/pagos/ok` y `app/pagos/ko` | Páginas de vuelta desde el banco |

## 4. Pantallas (solo visibles con el interruptor encendido)
- **Datos fiscales** en Mi cuenta: formulario con validación inmediata, casilla de zona fiscal especial, casilla de responsabilidad sobre los datos y aceptación de la autofacturación.
- **Publicar una sesión de pago** exige tener los datos fiscales completos; las sesiones gratis, no.
- **Reservar una sesión de pago** lleva a la página del banco; las gratis siguen como ahora.

## 5. Pruebas
- **Unitarias** (`node:test`): reparto y redondeo, validadores (casos válidos y erróneos), firma de Redsys con los ejemplos de su documentación.
- **Base de datos real** con la clave de servicio y datos temporales que se borran: idempotencia (confirmar el mismo pedido dos veces abona una), reparto, `requiere_reembolso` sin plazas, liberación a las 48 h, permisos (un usuario no lee la bolsa de otro).
- **Entorno de pruebas de Redsys** con sus credenciales públicas de pruebas: un cobro de extremo a extremo, siempre con el interruptor encendido solo en local.

## 6. Orden de trabajo y puntos de revisión
1. Configurar TypeScript solo para `lib/pagos/` y las rutas nuevas.
2. `dinero.ts` y `validaciones.ts`, con pruebas.
3. `redsys.ts`, con pruebas. **Revisión.**
4. `sql/071`. **Lo ejecutas tú.**
5. `sql/072` y pruebas de base de datos. **Lo ejecutas tú.**
6. Rutas `crear` y `webhook`, y páginas de vuelta.
7. Pantalla de datos fiscales y control al publicar.
8. Flujo de reserva con pago, con el interruptor.
9. Prueba completa en el entorno de pruebas de Redsys, y documentación.

## 7. Decisiones que tomo salvo que digas lo contrario
- **Pagar primero, reservar después.** Es lo menos invasivo para la función central de reservas. Si en el último momento no queda plaza, se marca para reembolso (la devolución automática por Redsys llega en la fase 2). La alternativa, retener la plaza 10 minutos, obliga a tocar el estado de las reservas.
- **Bonos:** el cobro de bonos va en la fase 2. La fase 1 solo cubre sesiones sueltas.
- **Solo España** (península, Baleares y los territorios forales con el mismo IVA). Canarias, Ceuta y Melilla quedan para revisión manual.

## 8. Lo que necesitaré de ti más adelante
- Ejecutar `sql/071` y `sql/072`, y crear la clave del IBAN en Vault.
- Las credenciales de pruebas de Redsys (son públicas y están en su documentación) en `.env.local`.
- En la fase 2, los datos de Ruleafit para las facturas (razón social, CIF, domicilio) y el formato del fichero que dé CaixaBank.
