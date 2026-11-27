# Auditoría de pagos · `feat/pagos-mejoras` (commit `ced2893`) · 27 de noviembre de 2026

## 1. Resumen ejecutivo

**El flujo de pagos funciona en el Preview con la base de pruebas y el TPV simulado. Todavía no está listo para
producción**, sobre todo porque la web sigue mostrando textos de «pago directo» con el pago online activo (A3) y
porque las devoluciones no se han probado contra Redsys.

| Métrica | Valor |
|---|---|
| Cuentas usadas | Organizador, alumno B, alumno C y administración (sesiones iniciadas por la persona dueña) |
| Sesiones de prueba publicadas | 5 |
| Cobros al terminar | 5 `pagado`, 6 `reembolsado`, 1 `fallido` |
| Devoluciones | 6 completadas, 0 rechazadas, 0 dudosas |
| Pagos de sesiones canceladas sin devolver | 0 |
| Pagados sin reserva activa / bolsas descuadradas | 0 / 0 |
| Crons fallidos en la base de pruebas | 0 |
| Tests locales sobre `ced2893` | 64/64 de pagos y 131/131 del resto |

La base usada es `ixeuanoikjftpdgezfyz` (pruebas), comprobado en las peticiones del navegador. No se ha movido dinero.
Las notificaciones quedan en la app; en pruebas no hay cron de envío push.

## Actualización: correcciones posteriores a estas pruebas
Corregidos en la rama **A3**, **B1** (`sql/104`) y las cuatro fricciones de UX, con tests y build en local. En el
Preview (`39b2fff`) se comprobaron A3, las horas sin segundos, el aviso de devolución y los enlaces del TPV.
**Pendiente: aplicar `sql/104` en pruebas (B1).** Lo descrito más abajo es lo observado en
`ced2893`.

Nuevo punto para el checklist:
- El aviso legal (`app/aviso-legal/page.js:45`) afirma que no se realiza ningún cobro en la plataforma y que se paga
  directamente al entrenador. Hay que cambiarlo (con revisión jurídica) antes de activar los pagos.
- La web dice que la devolución «se ha tramitado automáticamente»: solo es cierto en producción con el cron
  `103_blindaje_cobros_cron.sql` programado y las devoluciones probadas con Redsys.

## 0. Pruebas ejecutadas en el Preview

| Caso | Resultado |
|---|---|
| `mock-tpv` muestra «TPV SIMULADO» | Correcto |
| APIs sin credenciales o con token falso; firma falsa en TPV y webhook | Rechazadas |
| Publicar sesión de pago con perfil aprobado | Correcto |
| Publicar de pago sin datos fiscales (aviso en pantalla) | Bloqueado. El bloqueo del servidor solo se ha probado en local |
| Desglose antes de pagar | Muestra precio, 0,00 € de gestión, total y política |
| Doble clic en «Confirmar y pagar» | Una sola petición |
| «Atrás» desde el TPV | El botón queda activo y se reutiliza el mismo pedido |
| Recarga en mitad del TPV y tras autorizar | Sin duplicados; el aviso repetido responde `ya_procesado` |
| Pago autorizado / rechazado | `pagado` con reserva / `fallido` sin plaza, y se puede reintentar |
| Aviso del banco repetido | `pagado` y después `ya_procesado` |
| Dos pagan la última plaza | Uno `pagado`, otro `requiere_reembolso`; si falta el segundo pago, lo explica |
| Pago sin plaza | Visible en Mis reservas y reclamable |
| Reclamación: texto corto, doble clic, duplicada | Validada, un solo caso (RF-2026-000001), duplicada rechazada |
| Panel `/admin/incidencias` | No cierra sin respuesta; al resolver, el alumno ve estado y respuesta |
| `/admin` con cuenta de alumno | Sin acceso |
| Cancelación del alumno con más de 2 h | Devuelta |
| Cancelación del organizador (2 reservas) | Las dos devueltas |
| Reprogramar: sin cambios, menos de 24 h | Rechazado con mensaje |
| Reprogramar con 2 reservas | Aviso con antes y después; uno acepta, otro cancela sin coste y se le devuelve |
| Parada segura desde `/admin/alertas` | «Pagos en pausa. No se te ha cobrado nada»; al reanudar se paga |
| Alerta por firma no válida | Aparece y se puede resolver |
| 390×844, sin sesión (13 páginas) y con sesión (8 pantallas, desglose y TPV) | Sin desplazamiento horizontal |
| Consola | Sin errores en la fase sin sesión. Con sesión solo se revisó la ventana del organizador: intentos de acceso fallidos (400) y 3 rechazos de datos fiscales (422), ambos esperables |

### No probado en el Preview
- Formulario fiscal por el asistente: no introduce NIF ni IBAN en esta web. Se observó en la ventana del organizador
  que hubo 3 rechazos y después aprobación (cuenta terminada en 1332). Zonas especiales: solo en local.
- Autocancelación por mínimo de plazas (requiere esperar a la hora límite): solo en local.
- Borrado de cuenta (destructivo): solo en local.
- Cambio de ubicación al reprogramar, bonos, push, correos y Redsys real.

## Fallos abiertos hoy

### A3 · ALTO · Textos de pago directo con el pago online activo
- Ficha de una sesión de pago: «Se paga directamente al entrenador» (`app/clases/[id]/page.js:204`).
- Publicar: «Acuerda el precio con tus alumnos. A día de hoy, el 100% es para ti.», aunque hay comisión
  (`components/publicar/BloquePlazasPrecio.js:18-19`).
- Pasos: con `NEXT_PUBLIC_PAGOS_ACTIVOS=true`, abrir una sesión de pago o «Publicar sesión».

### B1 · BAJO · Plazas ocupadas en una sesión cancelada
- Tras cancelar el organizador, la sesión conserva 2 plazas ocupadas sin reservas activas.
- Origen: `cancelar_clase()` (`sql/047`). Anterior a esta rama; no afecta a cobros.

### Fricciones de UX
- La hora se ve con segundos («10:00:00») en ficha, tarjetas, Mis reservas y Mis sesiones.
- La tarjeta de sesión cancelada no dice nada de la devolución (`components/mis-reservas/TarjetaReservaCancelada.js`).
- Al cancelar a tiempo una reserva pagada, el mensaje no menciona la devolución (`components/mis-reservas/useMisReservas.js`).
- El TPV simulado no ofrece ir a `/pagos/ok` o `/pagos/ko`.

## Checklist obligatorio antes de producción
- [ ] Aplicar `sql/104` en pruebas y comprobar B1.
- [ ] Actualizar el aviso legal sobre los cobros en la plataforma.
- [ ] Probar cobro y devolución contra el entorno de pruebas de Redsys (devolución REST admitida por CaixaBank).
- [ ] SQL 096 y 098 a 104 en producción, en orden, con sus verificaciones (095 y 097 ya están). No ejecutar nada de `sql/pruebas`.
- [ ] Después de publicar: `099_alertas_operativas_cron.sql`; `103_blindaje_cobros_cron.sql` solo tras la prueba con Redsys.
- [ ] En producción: sin `MOCK_TPV_ACTIVO`; `/api/payments/mock-tpv` responde 404.
- [ ] Probar autocancelación por mínimo, zonas especiales y borrado de cuenta en pruebas.
- [ ] Decidir cómo se avisa de las revisiones fiscales manuales y si se verifica la titularidad de NIF e IBAN.
- [ ] Revisión jurídica y fiscal (aprobación automática, autofactura, privacidad, reclamaciones, plazos).
- [ ] Revocar el enlace Share usado en estas pruebas.
- [ ] `pagos_activos`, `PAGOS_ACTIVOS` y `NEXT_PUBLIC_PAGOS_ACTIVOS` en falso en producción hasta completar lo anterior.

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

