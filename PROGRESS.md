# Ruleafit — Estado actual

Última actualización: 27 noviembre 2026

Este archivo es solo el estado actual: qué está hecho, qué falta, ramas y SQL. El historial completo (decisiones,
pruebas e incidencias, fase a fase) está íntegro en `docs/historial/PROGRESS_HISTORIAL.md`: **no hace falta leerlo**
salvo para investigar por qué se hizo algo; en ese caso, buscar con Grep el tema y leer solo ese tramo. Al terminar un
trabajo se actualiza este archivo (corto) y, si hay detalle que conservar, se añade al final del historial.

| Para saber | Mirar |
|---|---|
| Reglas y decisiones de producto, mapa de carpetas | `CLAUDE.md` |
| Estado punto por punto del plan de mejoras | `docs/PLAN_MEJORAS_RULEAFIT.md` |
| Reglas de pagos, bolsas y bonos, y checklist antes de cobrar | `docs/REGLAS_PAGOS_RULEAFIT.md` |
| Probar en Preview con la base de pruebas | `docs/pruebas-preview.md` |

## 1. Ramas y entornos
| | `main` (producción) | `feat/pagos-mejoras` (Preview) |
|---|---|---|
| Web | https://www.ruleafit.com (deploy al hacer push a `main`) | Preview de Vercel de la rama |
| Base de datos | Supabase «ruleafit» (Irlanda) | Proyecto de pruebas aparte (`ixeuanoikjftpdgezfyz`) |
| Código | Hasta verificaciones de perfil y `/admin` | Además: pagos, Plan Pro, bonos y todo lo del apartado 3 |
| Pagos | **Apagados**. No se ha movido dinero | Activos con TPV simulado (`mock-tpv`) |

- `feat/verificaciones-perfil` y `prueba-avisos-zona` están integradas en `main` y en `feat/pagos-mejoras`.
- `feat/redsys-devoluciones` (`520937e`) y `fix/eliminar-cuenta-pagos` (`8326321`) se borraron el 27/11: su contenido
  está en `feat/pagos-mejoras`.
- `main` tiene un commit de fusión que no está en la rama; la mezcla de prueba no daba conflictos (27/11).
- Último SQL del repositorio: **113**. El titular pega los SQL a mano en el SQL Editor.
- Reglas firmes: no activar cobros reales; solo Redsys (CaixaBank); commit y push solo cuando se pidan.

## 2. SQL por entorno
| SQL | Contenido | Producción | Pruebas |
|---|---|---|---|
| hasta `094` | Web publicada (sesiones, avisos, bloqueos, series, centros, invitaciones, ubicaciones) | Aplicado | Aplicado |
| `095`, `097` | Borrado de cuenta con pagos; permisos | Aplicado (`097` según las reglas, no comprobado) | Aplicado |
| `096` | Devoluciones por Redsys | Falta | Aplicado |
| `098`, `099` | Reclamaciones; alertas y frenos | Falta | Aplicado |
| `100` | Reprogramaciones | Falta | Aplicado |
| `101`, `102` | Aprobación fiscal; devolución al cancelar sesiones | Falta | Aplicado |
| `103`, `104` | Blindaje de cobros; permisos explícitos | Falta | Aplicado |
| `105` | Mis ingresos y retención | Falta | Aplicado |
| `106`–`108` | Bonos online, Plan Pro, reclamación retiene bono | Falta | Aplicado |
| `109` | Sesión gratuita no gasta bono | Falta | Aplicado |
| `110`–`112` | Verificaciones de perfil y centros | Aplicado (sin constancia del script de verificación) | Aplicado |
| `113` | Bonos admitidos por sesión y protección del comprador | Falta | Aplicado y verificado (27/11) |

Antes de reejecutar un SQL antiguo, mirar su cabecera y `CLAUDE.md`: varios envuelven o sustituyen funciones de otros
(no reejecutar `096`/`103`/`105` después de `107`; `110` después de `112`; `088`/`109` sin volver a ejecutar `113`).

**Crons.** Pruebas: caducidad de cobros y liberación de saldos; **sin** alertas, devoluciones ni renovación Pro.
Producción: los de la web publicada (notificaciones, recordatorios, autocancelación, avisos de zona y su purga,
valoraciones, avisos de plaza, invitaciones) y ninguno de pagos. Sin programar: `099_alertas_operativas_cron.sql`,
`103_blindaje_cobros_cron.sql` y `107_pro_y_bonos_cron.sql` (los dos últimos, solo tras probar con Redsys).

## 3. Hecho

### Publicado en producción
- Base: cuentas (correo y Google, confirmación y recuperación), perfiles públicos, publicar y editar sesiones, reservar y
  cancelar (hasta el comienzo; devolución solo con 2 h o más), mínimo de plazas y autocancelación, asistencia automática,
  Rulos, valoraciones, seguir y favoritos, feedback, denuncias, bloqueos (invisibles y con cancelación de reservas),
  borrar cuenta, notificaciones push y campana, PWA, auditoría de seguridad `074`–`076`.
- Explora y mapa: buscador, ciudad y provincia, filtros de precio/duración/plazas, agrupación por organizador, foto en el
  zoom máximo, avisos de sesiones en mi zona (inmediatos y resumen 20:30), «Quién participa» opt-in.
- Mejoras del plan: series recurrentes, añadir al calendario, solicitud de valoración, avisos del organizador,
  ubicaciones habituales, ubicación única al publicar y editable sin mover reservas, alta de centros (`/centros`),
  reserva exprés, aviso de plaza libre y doble confirmación de última hora, invitaciones y perfiles compartibles.
- Verificaciones de perfil (identidad, centro, titulación) y panel `/admin`.

### Solo en `feat/pagos-mejoras` (Preview), sin publicar
- Cobro de sesiones y bonos por Redsys (probado solo con simulador), webhook, comisión 10 % y bolsa del organizador.
- Datos fiscales con aprobación automática (revisión manual en Canarias, Ceuta y Melilla); sesiones gratis sin datos
  fiscales.
- Devoluciones con estados y reintentos, devolución al cancelar o autocancelar, parciales de bonos.
- Desglose antes de pagar, reclamaciones económicas, alertas y frenos, reprogramaciones, «Mis ingresos» y retención.
- Un cobro en curso por alumno y sesión, con caducidad. Plan Pro y bonos online.
- 27/11 (`0910cc3`): elegir tarjeta o Bizum en sesiones; el alumno con bono elige canjearlo o pagar; el organizador
  marca qué bonos admite cada sesión; bono sin sesiones donde usarlo = aviso y devolución de lo no usado; estado de la
  devolución en Reclamaciones.
- 27/11: «Cancelar reserva» confirma dentro de la página (la ventana del navegador no aparecía) y está también en la
  ficha de la sesión.

## 4. Pendiente

### Ruta de pagos acordada (uno a uno, preguntando antes de pasar al siguiente)
Guía: PDF del plan del 27/11 (`docs/RuleaFit_Plan_Mejoras_Pagos_Agrupados_27-11-2026.pdf`, local, no se sube).

**Bloque A, sin banco**
1. Huecos de cobro. **Hecho** (apartado 3, 27/11).
2. Pruebas con el simulador en Preview. **Siguiente**: Bizum, bono o pago, bonos por sesión, devolución de bono sin
   sesiones, estado de la devolución, cancelar reserva; y lo que quedaba sin probar: bloqueo, retención por
   cancelaciones, anular bonos, autocancelación, zonas fiscales especiales y borrado de cuenta.
3. Liquidaciones: días 15 y último (siguiente hábil), mínimo 10 €, descifrado del IBAN, excluir lo retenido y decidir
   qué hacer con bonos aún devolubles y saldos negativos.
4. Fichero SEPA (pain.001) o el formato que dé CaixaBank.
5. Autofacturas en borrador (`AF-AAAA-NNNNNN`, aceptación tácita a 15 días) y facturas de Pro.
6. Textos legales.
7. Alertas y contracargos (programar crons; vigilancia externa).

Lo que dependa del asesor (IVA, IRPF, formato de facturas) se deja configurable y marcado.

**Bloque B, espera al banco**: TPV contratado con tarjeta y Bizum, devoluciones REST totales y parciales, tarjeta
guardada y cobro recurrente, claves de pruebas y producción, prueba en su entorno, confirmar parámetros de
`lib/pagos/redsys.ts` y formato del fichero de transferencias.

### Antes de activar pagos en producción
Orden completo en el apartado 8 de `docs/REGLAS_PAGOS_RULEAFIT.md`: asesor → banco → desarrollo → copia de seguridad,
SQL `096`, `098`–`109` y `113` con los pagos apagados, publicar la web, variables (sin `MOCK_TPV_ACTIVO`) y crons →
`107_pro_y_bonos_preactivacion.sql`, activar, un cobro real pequeño y su devolución.

- La parte web de `095` solo está en la rama: en producción la ruta de datos fiscales responde aunque la pantalla esté
  oculta.
- En producción había (27/11) 3 bonos y 1 adquirido por un usuario real: no tocarlos sin permiso.
- No borrar la cuenta de nadie ni tocar datos de producción sin autorización expresa.

### Asesor y jurista
- Si Ruleafit puede cobrar y guardar dinero de organizadores (servicios de pago).
- IVA de la comisión y de Pro, cuándo tributa un bono, autofacturas, IRPF, modelo 238 (DAC7), Canarias, Ceuta y Melilla.
- Desistimiento (sesiones con fecha, bonos y Pro) y la protección del comprador de un bono sin sesiones.
- Términos, condiciones de organizadores, cookies y aviso legal (borradores en `legal/borradores/`, sin publicar).
- Privacidad: contradicción de edad 14/18 publicada; localización de la zona habitual, transferencias internacionales y
  etiquetas de iOS; verificaciones de perfil; reclamaciones y plazos de conservación; centros (12 meses) y Resend.
- Verificar o no la titularidad de NIF e IBAN antes del primer pago; retener pagos a un organizador sospechoso (no hay
  botón); saldos negativos de quien deja la plataforma.

### Producto y técnica fuera de pagos
- Plan de mejoras: 35 sin hacer y 4 parciales (12, 30, 32, 33). Priorizadas: 02, 19, 25, 01, 07, 10, 12, 20 y 23.
- Verificaciones: probar la lectura automática y el visor con documentos reales en Preview.
- Plan Resend: gratuito, 100 correos al día; ampliarlo antes de una campaña.
- Seguridad: política `script-src` de CSP; vigilancia externa (`/api/health`) y copias de seguridad con restauración
  probada. Informes en `docs/auditoria-seguridad*.md`.
- Nominatim público lento a veces (valorar servicio propio).
- Revisión pendiente de los archivos sin uso (`BuscadorCiudad.js`, `IconoSilbato.js`, SVG de `public/`): no borrarlos sin
  permiso.
- Otros botones siguen confirmando con `window.confirm` (cancelar sesión, devolver bono, respuesta a un cambio…): si
  alguno «no hace nada» en algún navegador, pasarlo a confirmación en la página.

### Apps móviles (aparcadas)
- Android: generada y probada, sin publicar (`docs/app-android.md`). Falta cuenta de Play, prueba cerrada, ficha y
  revisión legal.
- iPhone: probada en un dispositivo, aparcada (`docs/app-ios.md`, `app-ios/README.md`). Falta cuenta de Apple Developer,
  inicio de sesión con Apple, push nativas, TestFlight y ficha.

### Apuntes antiguos sin confirmación posterior (comprobar antes de darlos por pendientes)
- Probar en móviles reales la vista previa del enlace y el botón de Instagram.
- Reindexación de `/ayuda` en Search Console y Redirect URL de producción de Google.
- Purga del historial antiguo de notificaciones.
- Limpieza de comentarios de cabecera antiguos en `sql/` (cambio de nombre).

## 5. Pruebas
- `npm run test:pagos` (obligatorio antes de un commit que toque pagos; 84 correctas el 27/11).
- `npm run test:verificaciones` (14 correctas el 27/11). Resto: `node --test` sobre `lib/*.test.js` y
  `components/**/*.test.js`.
- `npm run build` antes de proponer un commit con cambios de código.
- SQL: se prueba en local con PGlite desde archivos temporales; en pruebas, `sql/pruebas/` (nada de ahí en producción).
