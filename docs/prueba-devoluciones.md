# Prueba del cobro y la devolución en el TPV de pruebas de Redsys

Solo en local o en una base de datos de pruebas. NO activar `pagos_activos` en producción.

## Preparación
1. Aplicar `sql/071`, `072` y `096_devoluciones.sql` en un proyecto Supabase de PRUEBAS (no producción).
2. `.env.local`: `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`, `REDSYS_URL=https://sis-t.redsys.es:25443/sis/realizarPago` (opcional `REDSYS_REST_URL`), `PAGOS_ACTIVOS=true`, `CRON_SECRET`.
3. `update public.config_pagos set pagos_activos = true;` (solo en la base de pruebas).
4. El webhook necesita URL pública (túnel tipo ngrok) en `NEXT_PUBLIC_SITE_URL`.

## Ciclo
1. Entrenador con perfil fiscal activo publica una sesión de pago; un alumno paga con la tarjeta de pruebas de Redsys.
2. Comprobar: cobro `pagado`, reserva creada, `bolsas.pendiente_centimos` = neto.
3. El alumno cancela con 2 h o más (o el entrenador cancela / se bloquea): cobro → `requiere_reembolso`.
4. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/payments/devolver`
5. Comprobar: respuesta `completadas: 1`, cobro `reembolsado`, `devoluciones.estado = 'completada'` (código 0900), movimiento `reembolso` y bolsa del entrenador a 0.
6. Repetir el curl: no debe hacer nada (idempotente).
7. Casos: devolución rechazada (`fallida`, se reintenta hasta 5 veces) y sin respuesta (queda `en_curso`, revisión manual).

## Antes de activar pagos de verdad
Programar el cron de `/api/payments/devolver`, revisar los textos de reembolso y confirmar con CaixaBank que el terminal admite devoluciones por REST.
