# RuleaFit · Plan de mejoras · estado a 27 de noviembre de 2026

Actualiza el «Plan de mejoras actualizado» del 25/11/2026 (PDF del titular). Se mantiene su numeración.
Cada punto se ha contrastado con el código de `feat/pagos-mejoras` (commit `44e95ce`) y de `main` (`57f580a`).
Reglas de pagos: [REGLAS_PAGOS_RULEAFIT.md](REGLAS_PAGOS_RULEAFIT.md).

## 1. Resumen

| Marca | Significado |
|---|---|
| ✅ Publicado | En `main` (producción) |
| 🧪 En Preview | Hecho en `feat/pagos-mejoras`; no publicado y sin su SQL en producción |
| 🟡 Parcial | Existe una parte; se indica qué falta |
| ⬜ Pendiente | No hay nada, o solo una base que no cumple la propuesta |

| | 25/11 | Ahora |
|---|---|---|
| ✅ Publicado (del plan) | 14 | **15** (Hecho 01–14 + Pendiente 11) |
| 🧪 En Preview | — | **5** (31, 35, 36, 37, 38) |
| 🟡 Parcial | — | **4** (12, 30, 32, 33) |
| ⬜ Pendiente | 45 | **35** (27 generales y 8 de pagos) |
| Descartadas | 5 | 5 |

**Los pagos siguen apagados en producción.** `/pro` y `/mis-ingresos` no existen en la web publicada.

### Qué se ha comprobado y qué no
- Código leído y buscado en las dos ramas. `npm run test:pagos` 81/81, `test:verificaciones` 14/14, resto 131/131 y
  `npm run build` correcto.
- Base de **producción** (solo lista de tablas y columnas): están `sql/095` y `110`–`112`; no hay tablas de `096`–`109`.
- Base de **pruebas** (solo lectura): tablas de `096`–`107`, `110`–`112` y `109` aplicados; **`108` no está aplicado**.
- No se ha probado nada con cuentas reales, con el banco ni en pantalla en esta revisión.

## 2. Mejoras realizadas del plan (✅ publicadas)

| Nº | Mejora | Nota |
|---|---|---|
| Hecho 01 | Normas de cancelación | En Preview se añade: con un cambio sin responder, cancelar nunca es tardío |
| Hecho 02 | Sesiones recurrentes | |
| Hecho 03 | Añadir al calendario | |
| Hecho 04 | Solicitud de valoración | |
| Hecho 05 | Mensajes a participantes | |
| Hecho 06 | Ubicaciones habituales | |
| Hecho 07 | Filtros de precio, duración y plazas | |
| Hecho 08 | Alta guiada de centros | |
| Hecho 09 | Diversidad de organizadores por día | |
| Hecho 10 | Reserva exprés para visitantes | |
| Hecho 11 | Aviso de plaza libre | |
| Hecho 12 | Invitaciones y perfiles compartibles | |
| Hecho 13 | Una cuenta para organizar y reservar | |
| Hecho 14 | Doble confirmación de última hora | |
| **Pendiente 11** | **Entrenador verificado** (estaba aplazada) | «Titulación declarada» al subirla y «acreditada» tras revisión manual (`sql/110`–`112`). Falta probar con documentos reales y la revisión jurídica |

## 3. Pagos y monetización

Prioridad original / complejidad entre paréntesis.

### Antes de activar pagos (31–38)

| Nº | Propuesta | Estado | Hecho | Falta |
|---|---|---|---|---|
| 31 | Devoluciones por Redsys con conciliación (Imprescindible, 5/5) | 🧪 | Devolución por REST, estados, reintentos, devolución al cancelar o autocancelar (`sql/096`, `102`), parciales de bonos (`107`) | Prueba con Redsys, programar el cron (`103_…_cron.sql`); las respuestas dudosas se revisan a mano |
| 32 | Liquidaciones, autofacturas y fiscalidad (Imprescindible, 5/5) | 🟡 | Datos fiscales validados e IBAN cifrado, comisión 10 %, bolsa, liberación a 48 h, `/mis-ingresos` | Liquidaciones (días 15 y último, mínimo 10 €), descifrar IBAN, fichero SEPA, autofacturas, facturas de Pro, IVA/IRPF, contracargos |
| 33 | Pruebas de extremo a extremo y cierre de cuenta (Imprescindible, 4/5) | 🟡 | Simulador del TPV; pago, rechazo, aviso repetido, última plaza, devolución, bonos y reclamaciones probados en Preview; borrado de cuenta protegido | Redsys real. En Preview: bloqueo, retención por cancelaciones, anular bonos, autocancelación, zonas especiales, borrado de cuenta y `sql/108` |
| 34 | Coherencia legal (Imprescindible, 3/5) | ⬜ | Borradores en `legal/borradores/`; el aviso legal cambia el texto de pago según el interruptor | La privacidad sigue diciendo 14 años y el registro exige 18; publicar términos y condiciones; revisión jurídica |
| 35 | Incidencias y reclamaciones económicas (Imprescindible, 3/5) | 🧪 | Número RF-AAAA-NNNNNN, estados, `/admin/incidencias`, retención del dinero y «Devolver y cerrar» (`sql/098`, `105`, `108`) | Enseñar al alumno el estado de su devolución en Reclamaciones; privacidad y plazo de conservación |
| 36 | Alertas operativas (Imprescindible, 3/5) | 🧪 | Alertas, correo al administrador, frenos de cobros y devoluciones, `/admin/alertas` (`sql/099`) | Programar el cron en pruebas y producción; vigilancia externa |
| 37 | Desglose antes de pagar (Imprescindible, 2/5) | 🧪 | Mismo cálculo en navegador y servidor | Publicar; los impuestos no se desglosan aparte (confirmar con el gestor) |
| 38 | Reprogramaciones con aceptación y salida (Muy favorable, 4/5) | 🧪 | Aceptar o cancelar sin coste (`sql/100`). Se ve también con pagos apagados | Aplicar el SQL **antes** de publicar la web |

### Precios, promociones y reservas complejas (39–45)

| Nº | Propuesta | Estado | Nota |
|---|---|---|---|
| 39 | Oferta de primera sesión (Muy favorable, 3/5) | ⬜ | |
| 40 | Precio de última hora (Favorable, 4/5) | ⬜ | |
| 41 | Tarjetas regalo y códigos (Favorable, 4/5) | ⬜ | |
| 42 | Pago en un toque (Muy favorable, 3/5) | ⬜ | Sin Apple Pay ni Google Pay. Bizum solo se puede elegir al comprar bonos (ver apartado 5) |
| 43 | Apuntar a un acompañante (Muy favorable, 4/5) | ⬜ | |
| 44 | «Apúntame todas las semanas» (Favorable, 4/5) | ⬜ | Las series ya existen (Hecho 02) |
| 45 | Pagar cada uno su parte (Prescindible, 5/5) | ⬜ | |

## 4. Mejoras generales (01–30)

| Nº | Propuesta (prioridad, complejidad) | Estado | Qué hay hoy |
|---|---|---|---|
| 01 | Ordenar por cercanía (Muy favorable, 2/5) | ⬜ | Solo «las más cercanas» si la ciudad no tiene sesiones |
| 02 | Horario semanal en el perfil + cartel QR (Muy favorable, 2/5) | ⬜ | Calendario público en el perfil |
| 03 | Estadísticas para el organizador (Muy favorable, 3/5) | ⬜ | Contadores básicos en Mi cuenta (sesiones, valoración, seguidores) |
| 04 | Centro con varios monitores (Muy favorable, 5/5) | ⬜ | «Centro verificado» no da varios usuarios ni permisos |
| 05 | Encuesta de horario (Prescindible, 3/5) | ⬜ | |
| 06 | Aprobación manual opcional (Prescindible, 4/5) | ⬜ | |
| 07 | «¿Sigues viniendo?» (Muy favorable, 3/5) | ⬜ | |
| 08 | «¿Repetimos?» (Muy favorable, 2/5) | ⬜ | |
| 09 | Recordatorios por correo (Muy favorable, 2/5) | ⬜ | Los correos propios de la app van solo al administrador; al usuario, solo los de cuenta (Supabase) |
| 10 | Fotos propias de la sesión (Muy favorable, 3/5) | ⬜ | Imagen por categoría |
| 11 | Entrenador verificado (Muy favorable, 3/5) | ✅ | Ver apartado 2 |
| 12 | Nivel, qué traer y para quién (Muy favorable, 2/5) | 🟡 | Nivel y material al publicar y en la ficha. Faltan etiquetas de público y filtro por nivel |
| 13 | Primeros pasos personalizados (Muy favorable, 3/5) | ⬜ | |
| 14 | Vista de agenda en Explora (Favorable, 2/5) | ⬜ | Calendario solo en perfil y Mis sesiones |
| 15 | Rachas semanales (Favorable, 2/5) | ⬜ | |
| 16 | Insignias compartibles (Prescindible, 3/5) | ⬜ | Hay imagen para compartir una sesión, no insignias por hitos |
| 17 | A qué van las personas que sigues (Favorable, 3/5) | ⬜ | |
| 18 | Resumen del año (Prescindible, 3/5) | ⬜ | |
| 19 | Importar horarios por CSV (Muy favorable, 4/5) | ⬜ | |
| 20 | Alternativas a sesión llena o cancelada (Muy favorable, 3/5) | ⬜ | |
| 21 | Páginas locales y datos Event (Muy favorable, 3/5) | ⬜ | Sitemap y vista previa al compartir |
| 22 | Analítica del embudo (Muy favorable, 3/5) | ⬜ | |
| 23 | Accesibilidad y móvil (Muy favorable, 3/5) | ⬜ | Arreglos sueltos; sin auditoría WCAG 2.2 |
| 24 | «Mi semana» (Muy favorable, 2/5) | ⬜ | Próximas reservas en portada y Mis reservas |
| 25 | Prueba de usabilidad (Muy favorable, 1/5) | ⬜ | No es código; no consta hecha |
| 26 | Guardar sesión (Favorable, 2/5) | ⬜ | |
| 27 | Condiciones del espacio (Favorable, 3/5) | ⬜ | |
| 28 | Consultar al organizador (Favorable, 3/5) | ⬜ | |
| 29 | Exportar asistentes en CSV (Favorable, 2/5) | ⬜ | |
| 30 | Mínimo de plazas claro (Favorable, 2/5) | 🟡 | «Faltan N personas» en Mis reservas y Mis sesiones; la ficha y la tarjeta solo dicen «(ocupadas/mínimo)» |

## 5. Pendiente técnico detectado (además del catálogo)

1. **El pago de una sesión suelta siempre va con tarjeta.** La ficha dice «tarjeta o Bizum», pero
   `components/BotonReservar.js` no envía el método y el servidor usa tarjeta. En bonos sí se elige.
2. El servidor no impide pagar una sesión suelta a quien ya tiene un bono válido de ese organizador (solo la web).
3. En producción está `sql/095`, pero no su parte de web: el aviso al borrar la cuenta y el bloqueo que impide
   guardar datos fiscales con los pagos apagados (la pantalla está oculta; la ruta sí responde). Está en Preview.
4. Aplicar `sql/108` en la base de pruebas.
5. Enseñar el estado de la devolución en Reclamaciones.
6. Crons de pagos sin programar (alertas, devoluciones, renovación Pro).
7. Publicación: en producción faltan `096`–`109`, en orden y con los pagos apagados (apartado 8 de las reglas).
   `main` tiene un commit de fusión que no está en la rama; la mezcla de prueba no da conflictos.

## 6. Pendiente externo

| Quién | Qué |
|---|---|
| **Banco (CaixaBank / Redsys)** | Contratar el TPV con tarjeta y Bizum; devoluciones REST totales y parciales; tarjeta guardada y cobro recurrente; claves de pruebas y producción; probar en su entorno; formato del fichero de transferencias |
| **Asesor fiscal / gestor** | Si RuleaFit puede cobrar y guardar dinero de terceros; IVA (comisión, Pro, bonos); autofacturas, IRPF, modelo 238; Canarias, Ceuta y Melilla; quién paga a los organizadores |
| **Jurista** | Términos, condiciones de organizadores, privacidad (datos de localización, transferencias, tarjeta guardada, datos fiscales, verificaciones, conservación de reclamaciones), edad 14/18, desistimiento y renovación automática |
| **Titular** | Decisiones abiertas (apartado 10 de las reglas); probar las verificaciones con documentos reales; pruebas de usabilidad (25) |

## 7. Mejoras hechas que no estaban en el plan

### Publicadas
- Ubicación única al publicar: el pin fija municipio y provincia (25/11).
- Cambiar la ubicación de una sesión publicada sin afectar a quien ya reservó (`sql/094`, 25/11).
- Imagen nueva de «Quedadas deportivas» (25/11).
- «Identidad verificada» y «Centro verificado» con comprobación automática y denuncias de titulaciones (`sql/110`–`112`).
- Panel `/admin` (verificaciones y denuncias) con acceso solo para administradores.
- Retiradas las menciones a otras pasarelas: solo Redsys.
- Anteriores al informe del 22/11 y ausentes del catálogo: avisos de sesiones en mi zona, «Quién participa» con
  privacidad, bloqueos invisibles con cancelación automática, Favoritos, mapa con foto y agrupación por organizador,
  calendario en perfil y Mis sesiones, Mi cuenta por desplegables.

### En Preview (sin publicar)
- **Plan Pro** (40 €/mes) y **bonos online** con desistimiento, devoluciones y retenciones (`sql/106`–`108`).
- **Mis ingresos** y retención por reclamación (`sql/105`).
- Aprobación automática de datos fiscales, con revisión manual en Canarias, Ceuta y Melilla (`sql/101`, `102`).
- Un solo cobro en curso, caducidad a los 30 minutos y pagos sin plaza reclamables (`sql/103`).
- Sesiones gratuitas: publicar sin datos fiscales y reservar sin gastar bono (`sql/109`).
- Borrar la cuenta conservando los registros fiscales (`sql/095`, `097`; su SQL `095` ya está en producción) y segunda
  auditoría de seguridad.
- Permisos explícitos de tablas (`sql/104`), textos de pago según el interruptor y simulador del TPV.

## 8. Ideas descartadas (sin cambios)
01 Lista de espera automática · 02 Check-in obligatorio con QR y ubicación · 03 Créditos o cuota tipo ClassPass ·
04 Chat libre · 05 Vídeo o streaming como línea principal.

## 9. Ramas

| Rama | Situación |
|---|---|
| `main` | Producción, con verificaciones (`110`–`112`) |
| `feat/pagos-mejoras` | Preview: pagos, Pro y bonos (`095`–`109`) más las verificaciones |
| `feat/redsys-devoluciones` | Integrada por completo en `feat/pagos-mejoras` |
| `fix/eliminar-cuenta-pagos` | Su único commit está repetido en `feat/pagos-mejoras` con contenido idéntico |
| `feat/verificaciones-perfil`, `prueba-avisos-zona` | Integradas en `main` y en `feat/pagos-mejoras` |
