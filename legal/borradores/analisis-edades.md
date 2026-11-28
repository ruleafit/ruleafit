# Edades mínimas en Ruleafit — análisis y criterio provisional (28/11/2026)

> Análisis preparado con un asistente de IA. **No es un dictamen** y debe validarlo un jurista.
> Marcas: **[V]** comprobado en BOE o fuente oficial · **[S]** solo fuente secundaria · **[NV]** sin comprobar.

## Criterio provisional aplicado
| Umbral | Criterio | Cómo se aplica hoy en la rama `feat/pagos-mejoras` |
|---|---|---|
| Registro | **18 años** | Casilla obligatoria en el registro; aviso bajo «Continuar con Google» en el inicio de sesión; política de privacidad y aviso legal |
| Asistir y reservar (gratis o de pago) | **18 años** (hace falta cuenta) | Términos en borrador. No hay flujo para menores |
| Publicar y cobrar | **18 años cumplidos** | Fecha de nacimiento en el perfil fiscal (validada en el servidor) y verificación de identidad (rechaza si el documento muestra menos de 18) |

## 1. Registro
- Art. 7 LOPDGDD **[V]**: desde los 14 años el menor puede consentir por sí mismo el tratamiento de sus datos; salvo cuando la ley exija asistencia de los tutores para el acto en cuyo contexto se recaban.
- Art. 8 RGPD **[NV]**: consentimiento de niños en servicios de la sociedad de la información; no da capacidad para contratar.
- Art. 1263 CC **[S]**: el menor no emancipado solo puede celebrar los contratos que la ley le permita y los de la vida corriente propios de su edad. Arts. 1301-1304 CC **[NV]**: anulabilidad.
- La reforma que elevaba la edad de consentimiento a 16 (proyecto 121/000052) no se aprobó; las Cortes se disolvieron en octubre de 2026 **[S]**. Confirmar en congreso.es.
- Exigir 18 es en principio lícito y más seguro para contratar. Revisar su justificación frente a la Ley 15/2022 **[NV]**.
- La autodeclaración es un control débil (las directrices del art. 28 DSA no la consideran adecuada **[S]**; posible exclusión para microempresas **[NV]**).

## 2. Asistencia a sesiones
- Con 14-17 años es discutible que reservar y pagar sea un contrato «de la vida corriente».
- En las sesiones gratuitas siguen el riesgo físico, los datos y el deber de cuidado: la gratuidad no justifica rebajar la edad.
- Responsabilidad (arts. 1101, 1902 y 1903 CC **[NV]**): una autorización parental no exonera de negligencia.
- Si algún día entran menores: certificado negativo de delitos sexuales (art. 57 LO 8/2021 **[S]**), protocolos de protección en el deporte, normativa autonómica y seguros (en Andalucía, Ley 5/2016 **[S]**), imagen y evaluación de impacto.

## 3. Publicar y cobrar
- Art. 4 Código de Comercio **[V]**: mayores de edad con libre disposición de bienes (su aplicación a un entrenador profesional es discutible).
- Art. 9 Estatuto del Trabajo Autónomo **[V]**: prohibido a menores de 16. Los emancipados y los de 16-17 quedan excluidos por decisión de Ruleafit; justificarlo.
- DAC7, RD 117/2024, art. 5 **[V]**: nombre, dirección, NIF y país, número de IVA si se conoce y fecha de nacimiento; hay que verificarlos (art. 6) antes del 31/12. Modelo 238 en enero. No fija edad mínima.

## Huecos que quedan
1. La fecha del perfil fiscal la escribe el usuario: no acredita identidad y la verificación de identidad no es obligatoria.
2. Quien publica sesiones **gratuitas** no rellena datos fiscales: solo cuenta la declaración del registro.
3. En sociedades no se pide fecha de nacimiento: falta comprobar quién actúa y quién imparte.
4. No hay protocolo escrito para cuentas de menores detectadas (baja y devolución).
5. Las cuentas creadas antes de este cambio, o con Google desde el inicio de sesión, no marcaron ninguna casilla.

## Preguntas abiertas para el jurista
La principal está en `preguntas-asesor.md` (19). Conviene comentar además: si basta la autodeclaración, la responsabilidad de la intermediaria ante lesiones y el seguro, y el art. 57 LO 8/2021.

## Fuentes
- LOPDGDD: https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673
- Código de Comercio: https://www.boe.es/buscar/act.php?id=BOE-A-1885-6627
- Estatuto del Trabajo Autónomo: https://www.boe.es/buscar/act.php?id=BOE-A-2007-13409
- RD 117/2024: https://www.boe.es/buscar/act.php?id=BOE-A-2024-1771
- Proyecto 121/000052: https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF
