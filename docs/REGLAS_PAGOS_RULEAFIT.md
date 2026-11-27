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
| Medio de pago | Tarjeta o Bizum en el TPV virtual de CaixaBank (Redsys) | Preparado; probado solo con TPV simulado. El alumno elige el método en sesiones sueltas y en bonos |
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

Quien tiene un bono que vale para la sesión **elige**: reservar gastando una sesión del bono o pagarla y conservar el bono
(decisión del titular, 27/11/2026; no se bloquea el pago).

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

- El alumno ve en Mis reservas → Reclamaciones el estado de la devolución de cada caso: «en trámite» o «confirmada
  por el banco», con el importe. Un rechazo del banco se le sigue mostrando como «en trámite».
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

## 6 bis. Sesiones gratuitas (precio 0 €)
- **Publicar** una sesión o una serie gratuita no exige NIF, domicilio fiscal ni IBAN: basta con tener cuenta. Dejar el
  precio vacío equivale a 0 €. Los datos fiscales solo se piden para sesiones de pago, bonos y Pro.
- **Reservar** una sesión gratuita **nunca gasta un uso de bono** y no pasa por el TPV (`sql/109`). Si una sesión pasa a
  ser gratuita, sus reservas activas recuperan el uso. `109` devuelve además los usos ya gastados en sesiones gratuitas.

## 7. Entornos
| | Producción (`main`) | Preview (`feat/pagos-mejoras`) |
|---|---|---|
| Base de datos | proyecto «ruleafit» | proyecto de pruebas aparte |
| SQL | hasta 095 y 097, y 110-112 | base y 095-112 (108 y 109 comprobados el 27/11/2026); **113 sin aplicar** |
| Pagos | apagados | activos con TPV simulado |
| Crons de pagos | ninguno de alertas ni devoluciones | caducidad y liberación; sin alertas ni devoluciones |

## 8. Checklist antes de activar pagos en Producción (en este orden)

### A. Asesor legal y fiscal (puede cambiar el desarrollo)
- [ ] Confirmar que Ruleafit puede cobrar y guardar dinero de organizadores (normativa de servicios de pago) o cómo hacerlo.
- [ ] IVA: comisión del 10 %, si los 40 € de Pro lo incluyen y cuándo tributa un bono.
- [ ] Facturas de Ruleafit por Pro; autofacturas a organizadores; IRPF; modelo 238 (DAC7); Canarias, Ceuta y Melilla.
- [ ] Desistimiento de alumnos (sesiones con fecha y bonos) y de organizadores con Pro; 48 h desde el fin o desde la sesión.
- [ ] Términos, condiciones de organizadores, aviso legal, privacidad (tarjeta guardada, datos fiscales) y renovación automática.
- [ ] Verificar o no la titularidad de NIF e IBAN antes del primer pago.

### B. CaixaBank / Redsys
- [ ] Contratar el TPV virtual (CyberPack) con tarjeta y Bizum.
- [ ] Pedir devoluciones por REST, totales y parciales.
- [ ] Pedir tarjeta guardada (credencial almacenada) y cobro recurrente sin presencia del titular (MIT).
- [ ] Recibir comercio (FUC), terminal y claves de pruebas y producción; confirmar la versión de firma.
- [ ] Probar en su entorno de pruebas: cobro, rechazo, aviso, devolución total y parcial, alta de Pro y renovación; confirmar los
      parámetros de `lib/pagos/redsys.ts`.
- [ ] Formato del fichero de transferencias.

### C. Desarrollo pendiente
- [ ] Liquidaciones: días 15 y último, mínimo 10 €, descifrado del IBAN, fichero SEPA, excluir lo retenido y decidir qué hacer
      con bonos aún devolubles (14 días) y saldos negativos.
- [ ] Autofacturas y facturas de Pro.
- [x] Elegir tarjeta o Bizum al pagar una sesión suelta.
- [x] El alumno con bono elige entre canjearlo o pagar; el organizador marca qué bonos admite cada sesión (`sql/113`).
- [x] Estado de la devolución en Reclamaciones.
- [ ] Probar los tres puntos anteriores en Preview (con `sql/113` aplicado).
- [ ] Probar en Preview: bloqueo, retención por cancelaciones, autocancelación, zonas especiales y borrado de cuenta.

### D. Despliegue (con los pagos apagados)
- [ ] Copia de seguridad de la base de producción.
- [ ] SQL `096`, `098`, `099`, `100`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`, `109`, `113`, en orden, cada uno con su
      verificación. Nada de `sql/pruebas`.
- [ ] Publicar la web justo después.
- [ ] Vercel (Production): `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`, `REDSYS_URL` (y `REDSYS_REST_URL`),
      `CRON_SECRET`, `ADMIN_EMAILS`, `ALERTAS_ADMIN_EMAIL`, `NEXT_PUBLIC_SITE_URL`. Sin `MOCK_TPV_ACTIVO`; el simulador debe dar 404.
- [ ] Crons: `099`; `103` y `107` solo tras las pruebas con Redsys.

### E. Activación
- [ ] `107_pro_y_bonos_preactivacion.sql`.
- [ ] `PAGOS_ACTIVOS`, `NEXT_PUBLIC_PAGOS_ACTIVOS` y `config_pagos.pagos_activos`.
- [ ] Un cobro real pequeño y su devolución; revisar `/admin/alertas`.
- [ ] Saber quién paga a los organizadores antes del primer día 15, y revocar el enlace Share de pruebas.

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
| Cobro en curso · permisos · ingresos · bonos | `sql/103` · `sql/104` · `sql/105` (versión vigente de la liberación) · `sql/106` · bonos por sesión `sql/113` (versión vigente de `reservar_clase`) |
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
| Reservar | El alumno elige: canjearlo sin pasar por el TPV o pagar la sesión y conservarlo |
| Sesiones que lo admiten | El organizador marca en cada sesión o serie si se puede reservar con bono y con cuáles. Por defecto, todos, también los que cree después. Cambiarlo no toca las reservas hechas (`sql/113`). Si el alumno tiene varios válidos, se gasta el que antes caduca |
| Dinero | A `disponible` **48 h después de la compra** |
| Sesión usada | Las que ya han empezado y las canceladas tarde (menos de 2 h). Las reservas futuras se anulan al devolver y no cuentan |
| Desistimiento | 14 días naturales. Sin usar: 100 %. Usando hasta el **25 %**: parte no usada. Después o por encima: nada |
| Bono sin sesiones | Si **todas** las sesiones de pago próximas del organizador excluyen un bono vendido: se avisa al organizador antes de guardar y al cliente después, que puede pedir gratis la devolución de lo no usado, sin límite de 14 días ni de uso. El derecho dura hasta que vuelva a haber una sesión próxima que lo admita. Si queda alguna válida, o no hay ninguna publicada y no se había excluido antes, no se aplica (`sql/113`) |
| Caducidad | Lo no usado queda para el organizador |
| Organizador anula, bloquea, se da de baja o incumple | Se devuelve la parte no usada |
| Cancelaciones reiteradas | 3 sesiones con alumnos de bono canceladas en 30 días: se retiene su saldo de bonos y se avisa; se decide en `/admin/alertas` |
| Reclamación | Sobre el bono o sobre una sesión reservada con él: retiene su cobro (`sql/108`). En la del bono, «Devolver y cerrar» devuelve la parte no usada |
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
- Que el jurista confirme la protección del comprador cuando su bono se queda sin sesiones.
- El saldo de un bono está disponible a las 48 h y la devolución dura 14 días: las liquidaciones (sin implementar)
  deberán tenerlo en cuenta; una devolución posterior puede dejar el saldo en negativo.

## 13. Cómo entra el dinero (mapa del código)
| | Sesión suelta | Suscripción Pro | Bono online |
|---|---|---|---|
| Inicio | `/api/payments/crear` → `crear_cobro` | `/api/payments/pro` → `crear_pago_pro` | `/api/payments/crear` → `crear_cobro_bono` |
| Se guarda en | `cobros` (`tipo = sesion`) | `pagos_pro` | `cobros` (`tipo = bono`) |
| Confirmación (webhook) | `confirmar_cobro_pagado`: reserva y plaza | `confirmar_pago_pro`: activa o renueva | `confirmar_cobro_pagado`: crea `bonos_clientes` |
| Comisión | 10 % de ese cobro | Los 40 € son de Ruleafit | 0 % |
| Bolsa del organizador | Neto a `pendiente` | **No entra** | Importe a `pendiente` |
| A `disponible` | 48 h después de terminar la sesión | No aplica | 48 h después de la compra |
| Canjear / renovar | — | Cron `/api/payments/pro/renovar` | `reservar_clase`: ocupa plaza, sin cobro ni movimiento |

Cada movimiento queda en `movimientos_bolsa`; la liberación es `liberar_pendientes`. **Ningún importe se calcula por
sesión ni por plazas ocupadas**: la comisión se fija en cada cobro al crearlo.

**Sesión mixta** (comprobada el 27/11/2026 en la base de pruebas con `sql/pruebas/prueba_sesion_mixta.sql`, que no guarda
nada, y en el Preview): quien canjea bono y quien paga ocupan plaza; el canje no crea cobro ni mueve la bolsa; cada pago
suelto lleva su 10 %; `/mis-ingresos` muestra un apunte por cobro; al cancelar, se devuelve a quien pagó y el bono
recupera el uso.
