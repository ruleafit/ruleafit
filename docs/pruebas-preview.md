# Probar los pagos en Vercel Preview con el TPV simulado

Nada de esto toca producción ni activa cobros reales. El simulador (`/api/payments/mock-tpv`) responde 404 en
producción, sin `MOCK_TPV_ACTIVO=true` o si la base de datos es la de producción.

## 1. Proyecto Supabase de PRUEBAS (nuevo)
1. En supabase.com crea un proyecto `ruleafit-pruebas` (Irlanda). Anota su referencia (`https://<ref>.supabase.co`).
2. En **Database > Extensions** activa `pgcrypto`, `pg_cron` y `pg_net`.
3. Copia SOLO el esquema (sin datos) de producción. Necesita las herramientas de PostgreSQL 17 (`pg_dump`, `psql`).
   Las cadenas de conexión están en el botón **Connect** de cada proyecto (Session pooler). No las guardes en el repo.

```powershell
pg_dump --schema-only --schema=public --no-owner -f "$env:TEMP\esquema.sql" "<conexión de PRODUCCIÓN>"
```

```powershell
psql -f "$env:TEMP\esquema.sql" "<conexión de PRUEBAS>"
```

   El aviso «schema public already exists» es normal. Cualquier otro error hay que revisarlo.
4. En el SQL Editor **del proyecto de pruebas**, en este orden: `sql/096_devoluciones.sql`,
   `sql/098_incidencias_pago.sql`, `sql/099_alertas_operativas.sql`, `sql/100_reprogramaciones.sql`,
   `sql/101_aprobacion_fiscal_automatica.sql`, `sql/102_devoluciones_por_cancelacion.sql`, `sql/103_blindaje_cobros.sql`, `sql/104_permisos_explicitos.sql`, `sql/105_ingresos_retencion.sql`, `sql/106_bonos_con_pagos.sql`, `sql/107_pro_y_bonos.sql`, `sql/108_reclamacion_retiene_bono.sql`, `sql/109_gratis_sin_bono.sql`,
   `sql/pruebas/permisos_base_de_pruebas.sql` y, al final,
   `sql/pruebas/preparar_base_de_pruebas.sql`. (095 y 097 ya vienen en el volcado.) No ejecutes ningún `_cron.sql`.
5. **Authentication**: pon como *Site URL* la dirección del Preview y añade `https://*.vercel.app/**` a las
   direcciones de retorno. Para probar rápido, desactiva la confirmación de correo (solo en pruebas).
6. Opcional (fotos de perfil): crea el bucket público `avatares` y ejecuta `sql/021_storage_avatares_politicas.sql`.

## 2. Variables en Vercel, SOLO con la casilla «Preview»
Si alguna ya existe marcada «Production and Preview», **desmarca Preview** en la de producción (sin cambiar su
valor) y crea otra solo para Preview. Puedes limitarlas a la rama `feat/pagos-mejoras`.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de pruebas |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave anon de pruebas |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role de pruebas |
| `RESEND_API_KEY` | `re_pruebas` (inventada: no envía correos; sin ella no compila) |
| `PAGOS_ACTIVOS` | `true` |
| `NEXT_PUBLIC_PAGOS_ACTIVOS` | `true` |
| `MOCK_TPV_ACTIVO` | `true` |
| `MOCK_TPV_SUPABASE_REF` | referencia del proyecto de pruebas |
| `REDSYS_URL` | `/api/payments/mock-tpv` |
| `REDSYS_MERCHANT_CODE` | `999008881` |
| `REDSYS_TERMINAL` | `1` |
| `REDSYS_SECRET_KEY` | clave aleatoria propia (comando abajo) |
| `CRON_SECRET` | otro valor aleatorio, distinto del de producción |
| `ADMIN_EMAILS` | tu correo de la cuenta de pruebas (paneles `/admin/...`) |

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

No pongas en Preview `REDSYS_REST_URL`, las claves VAPID ni credenciales del banco.

## 3. Publicar el Preview y compartirlo
`git push -u origin feat/pagos-mejoras` crea el Preview (si ya había subido, usa **Redeploy** tras cambiar
variables). En Vercel, abre el despliegue y pulsa **Share** para crear el enlace privado. Mantén activa la
protección de despliegues: quien tenga el enlace puede usar el simulador.

## 4. Guion de prueba
Tres cuentas: organizador (A) y dos socios (B y C).
1. A rellena **Mi cuenta > Datos fiscales y cobros** con datos INVENTADOS (CIF `B00000000`, IBAN de ejemplo
   `ES9121000418450200051332`) y publica sesiones de pago, una de ellas con **1 plaza**.
2. B pulsa «Reservar», revisa el desglose y confirma: aparece el TPV simulado.
   - **Autorizado (0000)**: cobro `pagado` y reserva en Mis reservas.
   - Otra sesión, **Rechazado (0190)**: cobro `fallido`, ninguna plaza ocupada.
   - Otra, **Aviso repetido**: primero `pagado`, después `ya_procesado`, una sola reserva.
3. **Última plaza**: B y C abren el pago de la sesión de 1 plaza y NO pulsan nada más. Uno pulsa «Dos pagan la
   última plaza a la vez»: uno queda `pagado` y el otro `requiere_reembolso`.
4. **Devolución**: en el TPV simulado, «Procesar las devoluciones pendientes»: `completadas: 1`. B cancela una
   reserva pagada (2 h antes o más), vuelve a `/api/payments/mock-tpv` y repite.
5. Reclamaciones (Mis reservas), «Reprogramar» (A) y `/admin/alertas`, `/admin/incidencias` (correo de `ADMIN_EMAILS`).

Si aparece «Not Found» en el simulador, falta alguna condición: el motivo sale en los registros del despliegue.

## Límites
En el simulador no se reservan plazas antes de pagar (igual que con el banco real): «liberar la plaza» tras un
rechazo significa que nunca llega a ocuparse. Las notificaciones push y los correos no funcionan en Preview.
La prueba definitiva sigue siendo contra el entorno de pruebas de Redsys (`docs/prueba-devoluciones.md`).
