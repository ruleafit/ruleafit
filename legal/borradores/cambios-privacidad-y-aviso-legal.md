# Cambios necesarios en el aviso legal y la política de privacidad actuales — BORRADOR

Lista de lo que habrá que actualizar en `legal/aviso-legal.md` / `app/aviso-legal/page.js` y en `legal/politica-privacidad.md` / `app/privacidad/page.js` **cuando se activen los pagos**. Hoy esos textos son correctos para la versión sin cobros y no se tocan.

## Aviso legal
1. **Titular.** Hoy figura una persona física. Si se constituye una sociedad o se cambia el régimen para cobrar, actualizar nombre, NIF/CIF, domicilio y contacto. [REVISAR]
2. **Quitar** "no se realiza ningún cobro ni pago a través de la plataforma" y "el precio se abona directamente al entrenador fuera de la aplicación".
3. **Explicar el nuevo modelo:** cobro con el TPV de CaixaBank, intermediación en nombre del entrenador, comisión y remisión a los Términos y Condiciones.
4. **Enlazar** los nuevos Términos y Condiciones, Condiciones para entrenadores y Política de cookies, y añadir los enlaces en el pie de página y en la casilla de registro (hoy solo dice "aviso legal").
5. **Rulos:** mantener que no son dinero ni se compran, mientras no cambie el modelo.
6. Revisar la advertencia sobre actividad física y si debe haber consentimiento informado de riesgo.

## Política de privacidad
1. **Nuevas categorías de datos** de los entrenadores: NIF/DNI/NIE/CIF, domicilio fiscal, IBAN y titular, país de residencia fiscal, fecha de nacimiento, tipo de actividad.
2. **Finalidades y base legal:** ejecutar el contrato de cobro y liquidación; emitir autofacturas y cumplir obligaciones fiscales (obligación legal); informe anual de operadores de plataformas digitales; prevención del fraude (interés legítimo).
3. **Destinatarios y encargados:** CaixaBank y Redsys (pagos), Supabase (base de datos), Vercel (alojamiento), Resend (correo), Google (inicio de sesión) y la Administración tributaria cuando lo exija la ley.
4. **Conservación:** datos de facturación y fiscales el tiempo que exija la normativa tributaria y mercantil. [REVISAR plazo: suele ser entre 4 y 6 años]. El resto, mientras la cuenta esté activa y el plazo de prescripción de responsabilidades.
5. **Transferencias fuera del Espacio Económico Europeo** (proveedores con sede en EE. UU.): indicar las garantías. [REVISAR]
6. **Seguridad:** acceso restringido, IBAN cifrado.
7. **Derechos y reclamación ante la AEPD**, con el procedimiento y un correo de contacto.
8. **Menores:** el servicio es solo para mayores de 18.

## Tareas internas (no se publican)
- **Registro de actividades de tratamiento** (obligatorio al tratar datos de forma habitual).
- **Contratos de encargado del tratamiento** con los proveedores.
- **Evaluación de riesgos** al empezar a guardar IBAN y DNI, y plan de respuesta a brechas de seguridad (aviso a la AEPD en 72 horas).
- Función de **borrar la cuenta** y de **exportar los datos**.
