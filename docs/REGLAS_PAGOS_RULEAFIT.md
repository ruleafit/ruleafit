# Reglas de pagos, bolsas y bonos de Ruleafit · fuente única de verdad

Estado a 27 de noviembre de 2026, rama `feat/pagos-mejoras`. **En producción los pagos están apagados y no se ha
movido dinero.** Si este documento y el código no coinciden, manda el código (`sql/` y `lib/pagos/`) y hay que
corregir el documento. Sustituye como referencia a `docs/plan-pagos-fase-1.md` (plan original) y a la sección de
pagos de `PROGRESS.md` (historial).

## 1. Palabras que se usan
| Palabra | Qué es |
|---|---|
| **Cobro** | Un intento de pago de un alumno por una plaza (`cobros`) |
| **Bolsa** | Registro de lo que Ruleafit debe a cada organizador (`bolsas`): `pendiente` y `disponible`. No es una cuenta bancaria |
| **Movimiento** | Anotación de cada cambio de la bolsa (`movimientos_bolsa`), solo se añade |
| **Liquidación** | Transferencia del saldo disponible al IBAN del organizador. **Sin implementar** |
| **Bono** | Paquete de sesiones de un organizador. No es la bolsa. Con pagos activos se compra online (apartado 12) |
| **Rulos** | Puntos de fidelización. No son dinero |

## 2. Reglas y estado de cada una
| Regla | Valor | Estado |
|---|---|---|
| Medio de pago | Tarjeta o Bizum en el TPV virtual de CaixaBank (Redsys) | Preparado; probado solo con TPV simulado |
| Quién fija el precio | El organizador; la base de datos calcula el importe | Hecho |
| Comisión | 10 % del precio, a cargo del organizador. Mitades hacia arriba, al céntimo | Hecho |
| Al confirmarse el pago | Reserva, plaza ocupada y neto a la bolsa `pendiente` | Hecho |
| Paso a `disponible` | 48 h después de **terminar** la sesión (sin duración cuenta 60 min). Cada 15 min | Hecho |
| Retención | Con reclamación abierta o en revisión no se libera | Hecho (`sql/105`) |
| Pantalla del saldo | `/mis-ingresos` (menú, solo con pagos visibles) | Hecho |
| Liquidación | Días 15 y último de mes (siguiente hábil), mínimo 10 €, el resto se acumula | **Falta** |
| Fichero bancario | SEPA XML (pain.001) o el formato que dé CaixaBank | **Falta** (tampoco se descifra aún el IBAN para pagar) |
| Autofacturas | Una por liquidación, serie `AF-AAAA-NNNNNN`, aceptación tácita a los 15 días | **Falta** (pendiente del gestor) |
| IVA e IRPF | IVA 21 % general; IRPF 15 % (7 % reducido) a personas físicas; foral y zonas especiales aparte | **Falta**, a confirmar |
| Contracargos | Se descuentan de la bolsa | **Falta** el proceso |
| Bonos con pago online y Plan Pro | Apartado 12 | Hecho en la rama (`sql/107`); solo probado con simulador |

Los valores 10 %, 48 h, 10 € y 15 días están en `config_pagos`. La web repite el 10 % en
`COMISION_BPS_PREVISTA` (`components/publicar/PrevisionIngreso.js`) solo como estimación: si cambia, cambiar ambos.

## 3. Estados de un cobro
```
creado ──pago autorizado──▶ pagado ──cancelación con derecho──▶ requiere_reembolso ──banco confirma──▶ reembolsado
   │                          └─ 48 h tras la sesión ─▶ neto a disponible
   ├─ rechazado ─▶ fallido
   └─ 30 min sin respuesta ─▶ caducado (una confirmación tardía se sigue procesando)
```
- Un solo cobro en curso por alumno y sesión.
- Si al confirmarse no queda plaza o la sesión está cancelada: `requiere_reembolso`, sin abonar nada.
- El aviso del banco repetido no duplica nada.

## 4. Cuándo se devuelve
| Situación | Devolución | Para el organizador |
|---|---|---|
| El organizador cancela la sesión (o la serie) | Íntegra | Se anula su neto |
| No se llega al mínimo de plazas | Íntegra | Se anula |
| El alumno cancela con 2 h o más | Íntegra | Se anula |
| El alumno cancela con menos de 2 h | **No** (con bono, la sesión se consume) | Cobra normalmente |
| Cambio de fecha, hora o lugar y el alumno no lo acepta | Íntegra, sin coste | Se anula |
| Bloqueo entre usuarios con reserva futura | Íntegra | Se anula |
| Pago sin plaza | Íntegra | No llegó a anotarse |
| Reclamación aceptada («Devolver y cerrar») | Íntegra | Se anula o se descuenta |

- La devolución la pide `/api/payments/devolver` (cron cada 10 min, **sin programar**). Solo la confirmación del banco
  marca `reembolsado` y ajusta la bolsa.
- Rechazada: se reintenta hasta 5 veces. Sin respuesta: queda `en_curso` y se revisa a mano.
- Si el neto ya estaba disponible, se resta de `disponible`, que puede quedar en negativo.

## 5. Reclamaciones, alertas y frenos
- Reclamaciones (`Mis reservas`): motivos cobro, cancelación o reembolso; número `RF-AAAA-NNNNNN`; estados recibida,
  en revisión, resuelta y no procede. Panel `/admin/incidencias`.
- **Cerrar un caso sin «Devolver y cerrar» libera el dinero al organizador.**
- Alertas en `/admin/alertas` y por correo. Frenos `parada_cobros` y `parada_devoluciones`: se activan ante fallos
  críticos y se quitan a mano. **Nunca usar `pagos_activos` como freno**: apagado, las sesiones de pago se reservan
  sin pagar.

## 6. Datos fiscales del organizador
Mi cuenta → Datos fiscales y cobros. Se validan NIF/NIE/CIF, IBAN español, dirección y casillas; se aprueban solos,
salvo Canarias, Ceuta y Melilla (revisión manual). Solo con estado `activo` se puede publicar de pago y cobrar. El
IBAN se guarda cifrado. No se comprueba que el NIF o el IBAN sean de la persona.

## 7. Entornos
| | Producción (`main`) | Preview (`feat/pagos-mejoras`) |
|---|---|---|
| Base de datos | proyecto «ruleafit» | proyecto de pruebas aparte |
| SQL | hasta 095 y 097 | base y 095-106; 107 cuando se aplique |
| Pagos | apagados | activos con TPV simulado |
| Crons de pagos | ninguno de alertas ni devoluciones | caducidad y liberación; sin alertas ni devoluciones |

## 8. Pasar a producción (en este orden)
1. Revisión jurídica y fiscal: términos, condiciones de organizadores, aviso legal, privacidad.
2. Contratar el TPV en CaixaBank y probar cobro y devolución en el entorno de pruebas de Redsys
   (`docs/prueba-devoluciones.md`). Confirmar que admite devoluciones por REST.
3. Con los pagos apagados: SQL `096`, `098`, `099`, `100`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, cada uno con su
   verificación. Nada de `sql/pruebas`.
4. Publicar la web.
5. Variables en Vercel (Production): `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`, `REDSYS_URL`
   (y `REDSYS_REST_URL` si procede), `CRON_SECRET`, `ADMIN_EMAILS`, `ALERTAS_ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL`.
   Sin `MOCK_TPV_ACTIVO`.
6. `099_alertas_operativas_cron.sql`; `103_blindaje_cobros_cron.sql` solo tras la prueba con Redsys; `107_pro_y_bonos_cron.sql` solo
   con el cobro recurrente contratado y probado. Justo antes de activar: `107_pro_y_bonos_preactivacion.sql`.
7. Tener resuelto cómo se paga a los organizadores antes del primer día 15.
8. Solo entonces: `PAGOS_ACTIVOS`, `NEXT_PUBLIC_PAGOS_ACTIVOS` y `config_pagos.pagos_activos`.

## 9. Para Redsys
Datos que pedir al banco: número de comercio (FUC), terminal, clave de firma SHA-256 de pruebas y de producción,
Bizum activado, devoluciones por REST y formato del fichero de transferencias. La web envía el aviso de pago a
`/api/payments/redsys-webhook`, vuelve a `/pagos/ok` o `/pagos/ko` y usa el nombre comercial RULEAFIT.

## 10. Decisiones abiertas
- El borrador legal dice 48 h «desde la sesión»; el sistema cuenta desde que termina.
- Comisión: ¿con IVA incluido o aparte?
- Retener pagos a un organizador sospechoso (el borrador lo permite; no hay botón).
- Verificar la titularidad de NIF e IBAN antes del primer pago.
- Saldo negativo de quien deja de usar la plataforma.

## 11. Dónde está cada cosa
| Tema | Archivo |
|---|---|
| Reparto (única lógica TS) | `lib/pagos/dinero.ts` |
| Tablas y funciones base | `sql/071`, `sql/072` |
| Devoluciones · reclamaciones · alertas | `sql/096` · `sql/098` · `sql/099` |
| Reprogramaciones · fiscal · cancelaciones | `sql/100` · `sql/101` · `sql/102` |
| Cobro en curso · permisos · ingresos · bonos | `sql/103` · `sql/104` · `sql/105` (versión vigente de la liberación) · `sql/106` |
| Cobro, aviso del banco, devolución | `app/api/payments/` |
| Pantalla del organizador | `app/mis-ingresos`, `components/ingresos` |
| Borradores legales | `legal/borradores/` |
| Pruebas en Preview · informe | `docs/pruebas-preview.md` · `docs/AUDITORIA_PAGOS_STAGING.md` |

## 12. Plan Pro y bonos (reglas del titular, 27/11/2026)
Implementado en `sql/107`. Cobros reales apagados; el cobro mensual solo se ha probado con el simulador.

### Plan Pro
| Regla | Valor |
|---|---|
| Precio | **40 €/mes** (IVA según configuración fiscal), sin prueba gratuita |
| Alta | La hace el organizador con tarjeta (Redsys, tarjeta guardada en el banco). Exige datos fiscales aprobados |
| Incluye | Crear y vender bonos |
| Cancelar | Botón en `/pro`: detiene la renovación; Pro sigue hasta fin del mes pagado. Se puede reactivar |
| Devolución | En los 14 días del **primer** alta: íntegra si no ha vendido bonos; proporcional a los días si ha vendido. Pro termina al pedirla |
| Cobro fallido | 3 días de margen con un reintento diario; después caduca. Respuesta dudosa del banco: no se reintenta, se revisa |
| Al caducar | No se crean ni venden bonos; los vendidos siguen funcionando |

### Bonos
| Regla | Valor |
|---|---|
| Publicar | Pro activo y fiscal aprobado. Sesiones cerradas (no ilimitados). Duración: 30 días o sin caducidad |
| Cambios | Un bono vendido no cambia de precio, sesiones ni duración |
| Comprar | Cualquier alumno, por el TPV (tarjeta o Bizum). Comisión **0 %** (configurable) |
| Reservar | Se canjea sin pasar por el TPV |
| Dinero | A `disponible` **48 h después de la compra** |
| Sesión usada | Las que ya han empezado y las canceladas tarde (menos de 2 h). Las reservas futuras se anulan al devolver y no cuentan |
| Desistimiento | 14 días naturales. Sin usar: 100 %. Usando hasta el **25 %**: parte no usada. Después o por encima: nada |
| Caducidad | Lo no usado queda para el organizador |
| Organizador anula, bloquea, se da de baja o incumple | Se devuelve la parte no usada |
| Cancelaciones reiteradas | 3 sesiones con alumnos de bono canceladas en 30 días: se retiene su saldo de bonos y se avisa; se decide en `/admin/alertas` |
| Reclamación | Retiene ese cobro. «Devolver y cerrar» devuelve la parte no usada |
| Borrar la cuenta | Imposible con usos pendientes vendidos. Antes: «Cancelar mis bonos y devolver lo no usado» y esperar las devoluciones |

**Por qué el 25 %:** el 15 % pedido al principio no dejaba usar ni una sesión en un bono de 4 o de 5. El 25 % es la
cifra más baja que lo permite en los tamaños habituales: bono de 4 → 1 sesión; de 5 → 1; de 8 → 2; de 10 → 2. En bonos
de 1 a 3 sesiones solo hay devolución voluntaria sin haber usado ninguna.

Los valores (40 €, 0 %, 14 días, 25 %, 3 días de margen, 3 cancelaciones en 30 días) están en `config_pagos`.

### Bonos anteriores
Con pagos activos no se venden ni se reactivan. Pruebas: `sql/pruebas/limpiar_bonos_de_pruebas.sql`. Producción:
`sql/107_pro_y_bonos_preactivacion.sql` los desactiva sin borrarlos y respeta los adquiridos (el 27/11/2026 había 3
bonos y 1 adquirido).

### Pendiente
- Contratar con CaixaBank la tarjeta guardada y el cobro recurrente, y confirmar los parámetros (`lib/pagos/redsys.ts`).
- Facturas de Ruleafit al organizador por Pro.
- Revisión jurídica: textos de Pro y de bonos, desistimiento, aviso legal y condiciones.
- El saldo de un bono está disponible a las 48 h y la devolución dura 14 días: las liquidaciones (sin implementar)
  deberán tenerlo en cuenta; una devolución posterior puede dejar el saldo en negativo.
