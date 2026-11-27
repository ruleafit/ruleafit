# Auditoría de pagos · `feat/pagos-mejoras` (commit `3605077`) · 27 de noviembre de 2026

Reglas vigentes: `docs/REGLAS_PAGOS_RULEAFIT.md`.

## 1. Resumen
**El pago de sesiones sueltas, las devoluciones simuladas, la bolsa del organizador y las reclamaciones funcionan en
el Preview con la base de pruebas.** No está listo para producción: faltan la venta online de bonos y su suscripción,
las liquidaciones al IBAN, la prueba con Redsys y la revisión jurídica.

| Métrica al terminar | Valor |
|---|---|
| Cuentas usadas | Organizador, dos alumnos y administración (sesiones iniciadas por la persona dueña) |
| Cobros | 4 `pagado`, 7 `reembolsado`, 1 `fallido` |
| Devoluciones | 7 completadas, ninguna en curso ni fallida |
| Bolsas frente a sus movimientos | Cuadran |
| Crons fallidos (24 h, base de pruebas) | 0 |
| Bonos adquiridos con pagos activos | 0 |
| Tests locales | 73/73 de pagos y 131/131 del resto; build correcto |

Base usada: `ixeuanoikjftpdgezfyz` (pruebas). No se ha movido dinero y en producción no se ha ejecutado nada.

## 2. Ronda del 27 de noviembre (textos, bonos, bolsa y saldo)
| Caso | Resultado |
|---|---|
| Portada, aviso legal, ficha y publicar con pagos visibles | Textos de pago online; no aparecen los antiguos |
| Fechas y horas en sesiones, Mis reservas, Mis sesiones y Rulos | Sin segundos |
| Sesión cancelada por el organizador | El alumno ve «Devolución íntegra completada» |
| Bono con pagos activos | Sin botón «Adquirir»; la base rechaza el alta (probado en una transacción que no guardó nada). Bono de prueba desactivado |
| Sesión celebrada: paso a disponible | QA1 se liberó a las 02:45:00 UTC del 27/11, justo 48 h después de terminar; QA2 también está disponible. Sus fechas se habían adelantado en la base de pruebas |
| Saldo del organizador en `/mis-ingresos` | Pendiente, disponible y liquidado coinciden con el historial |
| Reclamación sobre un cobro pendiente y sobre otro ya disponible | Ambos «Retenido por reclamación»; salen de pendiente y disponible (12,15 € retenidos) |
| «Devolver y cerrar» con respuesta | Caso resuelto, reserva cancelada, `requiere_reembolso` y «En devolución al alumno» |
| Procesar devoluciones (banco simulado) | 1 completada; «Devuelto al alumno» |
| «No procede» sobre el cobro disponible | Vuelve a disponible (12,15 €) |
| 390 px: ingresos, portada, aviso legal, perfil, publicar, Mis sesiones y Mis reservas | Sin desplazamiento horizontal |
| Consola | Sin errores de página en lo recorrido |

«Devolver y cerrar» sin escribir respuesta no se pulsó en esta ronda. Que un cobro con reclamación abierta no se
libere al cumplir el plazo solo se ha probado en local.

## 2 bis. Plan Pro, bonos y sesión mixta (commit `7b2f8ea`, SQL 107 aplicado en pruebas)
| Caso | Resultado |
|---|---|
| Pro: contratar sin marcar la autorización | Botón desactivado |
| Alta con TPV simulado; cancelar y reactivar la renovación | Correcto |
| Renovación denegada y aprobada | «Impagada» con 3 días de margen; después cobrada |
| Sin Pro o sin fiscal | Aviso y sin botón «Crear bono» |
| Publicar bono (30 días o sin caducidad) y comprarlo con aviso repetido | Un solo bono; `ya_procesado` |
| Sesión mixta en pantalla (Zumba) | Bono: «Total a pagar ahora: 0,00 €». Pago suelto: 6,00 €, 5,40 € netos. 2 plazas |
| Liberación del bono (adelantando 48 h en el simulador) | A disponible |
| Devolución con una reserva futura | 20,00 € íntegros; reserva anulada; bolsa cuadrada |
| Reclamación sobre un bono y «Devolver y cerrar» | Retenido; devuelto |
| Baja de Pro con devolución, minutos después del alta y con bonos vendidos | Proporcional (40,00 € redondeados); los bonos dejan de venderse |
| 390 px: Pro, Mis sesiones, bonos comprados, ingresos y cuenta | Sin desplazamiento horizontal |
| Base al terminar | 9 devoluciones completadas, bolsas cuadradas, sin alertas ni crons fallidos |

Sin probar en el Preview (sí en local): bloqueo, retención por cancelaciones reiteradas, anular bonos desde el
organizador, borrado de cuenta y `sql/108` (pendiente de aplicar en pruebas). Corregido tras la prueba: un bono anulado
salía como «caducado» en Mis sesiones.

## 3. Pruebas anteriores en el Preview (commits `ced2893` y `39b2fff`)
| Caso | Resultado |
|---|---|
| `mock-tpv` muestra «TPV SIMULADO» | Correcto |
| APIs sin credenciales o con token falso; firma falsa en TPV y webhook | Rechazadas |
| Publicar de pago con perfil aprobado / sin datos fiscales | Correcto / bloqueado en pantalla |
| Desglose antes de pagar; doble clic; «Atrás» desde el TPV; recarga | Sin duplicados; se reutiliza el pedido |
| Pago autorizado / rechazado / aviso repetido | `pagado` / `fallido` y reintento / `ya_procesado` |
| Dos pagan la última plaza | Uno `pagado`, otro `requiere_reembolso`, visible y reclamable |
| Reclamación: texto corto, doble clic, duplicada, acceso sin permiso | Validado y rechazado |
| Cancelación del alumno (más de 2 h) y del organizador | Devueltas |
| Reprogramar | Reglas de 24 h; uno acepta, otro cancela sin coste y se le devuelve |
| Parada segura y alerta por firma no válida | Correctas |

## 4. No probado en el Preview
Formulario fiscal por el asistente (no introduce NIF ni IBAN), zonas especiales, autocancelación por mínimo, borrado
de cuenta, cambio de ubicación al reprogramar, compra de bonos (no existe), push, correos y Redsys real.

## 5. Abierto
Ver el checklist del apartado 8 de `docs/REGLAS_PAGOS_RULEAFIT.md`. Lo más importante: las liquidaciones no existen y falta
todo lo de Redsys real, fiscal y legal.

Sesiones gratuitas (27/11/2026): en la base de pruebas, una cuenta sin datos fiscales publica sesión y serie a 0 € y la
de pago se rechaza (probado sin guardar nada). Corregido: publicar con el precio vacío fallaba. `sql/109` (el bono no se
gasta en sesiones gratuitas) probado en local y pendiente de aplicar en pruebas.

---

# Anexo · Auditoría local anterior (commit `bc3a9db`)
C1, C2, C3 (cron preparado, sin programar), A1, A2, M1, M2 y M3 se corrigieron con SQL 102 y 103.
Los textos siguientes describen lo observado antes del arreglo.

## 2. Fallos encontrados

### C1 · CRÍTICO · Cancelación del organizador sin devolución
- **Pasos:** el alumno paga una sesión → el organizador la cancela (suelta o serie).
- **Observado:** el cobro sigue `pagado`; `reclamar_devolucion()` responde `nada_pendiente`; el neto (5,40 € de 6 €) queda en `bolsas.pendiente_centimos`.
- **Esperado:** `requiere_reembolso`. Es lo que promete el desglose («Si quien organiza cancela… devolución íntegra»).
- **Origen:** `cancelar_clase()` en `sql/047_cancelacion_via_generar.sql` no toca `cobros`. Limitación ya anotada en `sql/072_pagos_funciones.sql`.
- **Agravante:** la alerta `devoluciones:sesion_cancelada` (`sql/099`) sí lo detecta, pero solo avisa.

### C2 · CRÍTICO · Autocancelación por mínimo de plazas sin devolución
- **Pasos:** sesión con mínimo 3 y un alumno que paga → llega la hora límite → corre `autocancelar_clases_sin_minimo()`.
- **Observado:** sesión `cancelada`, cobro `pagado`.
- **Origen:** `sql/053_fix_plazas_ocupadas_autocancelacion.sql`.

### C3 · CRÍTICO para producción · Nada ejecuta las devoluciones
- `/api/payments/devolver` solo actúa si alguien la llama. No existe ningún `_cron.sql` que la programe (revisión de `sql/`).
- Los cobros `requiere_reembolso` se quedarían así; la única señal es una alerta a las 48 h.

### A1 · ALTO · El alumno puede perder el rastro de su devolución
- Tras C1, el alumno **puede borrar su cuenta** con el cobro todavía `pagado`.
- **Origen:** `eliminar_mi_cuenta()` (`sql/095`) solo bloquea cobros pagados de sesiones `activa` futuras.

### A2 · ALTO · Quien paga y se queda sin plaza no puede reclamar
- **Pasos:** dos personas pagan la última plaza a la vez (o el banco confirma tras cancelarse la sesión).
- **Observado:** cobro `requiere_reembolso`, sin reserva; `mis_reservas_reclamables()` devuelve 0 y en Mis reservas no aparece nada.
- **Origen:** `sql/098_incidencias_pago.sql` (reclamaciones ligadas a una reserva), `components/mis-reservas/useMisReservas.js`.

### M1 · MEDIO · El servidor no exige datos fiscales para publicar de pago
- Un `insert` directo con precio 6 € y sin perfil fiscal **se acepta**. El control está solo en el navegador (`components/publicar/enviarSesion.js:71`, `enviarSerie.js:54`), que además deja publicar con estado `pendiente_revision`.
- Efecto: sesión que nadie puede pagar ni reservar sin bono (`crear_cobro` la rechaza).

### M2 · MEDIO · Dos pagos del mismo alumno
- Dos inicios de pago (dos pestañas) crean dos cobros y los dos se pueden pagar: el segundo queda `requiere_reembolso`. Se le cobra dos veces y depende de C3.
- **Origen:** `crear_cobro()` en `sql/072`.

### M3 · MEDIO · Cobros abandonados sin caducidad
- Cerrar el TPV deja el cobro en `creado` para siempre (comprobado a los 3 días). Durante 24 h impide borrar la cuenta.

## 3. Comprobado correcto (base local)
- Bloqueo y cancelación a tiempo del alumno: `requiere_reembolso`.
- Pago rechazado: `fallido`, sin plaza, y se puede reintentar.
- Última plaza: un `pagado` y un `requiere_reembolso`.
- Confirmación del banco tras cancelarse la sesión: `requiere_reembolso`.
- Doble cancelación y cancelación de reserva ajena: rechazadas.
- Reprogramación: salir deja `requiere_reembolso`; responder dos veces se rechaza.
- Organizador con sesiones futuras reservadas: no puede borrar su cuenta.

## 4. Fricciones de UX y mejoras (por revisión de código; sin verificar en pantalla)
- Volver atrás desde el TPV podría dejar «Abriendo el pago…» bloqueado: `pagando` no se restablece (`components/BotonReservar.js`). **Probable, sin comprobar.**
- El TPV simulado no ofrece ir a `/pagos/ok` o `/pagos/ko`, así que esas pantallas no se prueban.
- «Sesiones canceladas por el organizador» no dice nada de la devolución (`components/mis-reservas/TarjetaReservaCancelada.js`).
- Zonas especiales: la pantalla dice «revisaremos tus datos a mano» (`components/PerfilFiscal.js:201`) pero ahora se aprueban solos. Decidir.
- La validación fiscal es matemática: no comprueba que el NIF o el IBAN sean de la persona. Valorar una verificación antes del primer pago.
- Un rechazo no queda registrado en la base de datos.

