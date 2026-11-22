# Lanzamiento público de «Avisos de sesiones en mi zona»

Estado a 22-nov-2026: pruebas reales de las fases 4, 5 y 6 superadas (campana y push a Cl; 0 avisos a otros usuarios). Interruptores apagados. **Nada de lo de abajo se ha hecho todavía; cada paso exige autorización.**

## Qué falta en `main`
`prueba-avisos-zona` va 7 commits por delante de `main` y `main` no ha avanzado desde que se creó la rama (la fusión es directa, sin conflictos). Contiene 37 archivos:
- **Visible para usuarios (pero oculto en Producción hasta definir la variable):** sección «Avisos de sesiones en mi zona» en Mi cuenta, página `/sesiones-en-mi-zona`.
- **Cambia el comportamiento de Producción en cuanto se despliega:** `lib/consultaNotificaciones.js` (la campana y el historial piden 10 normales + 3 de zona; para quien no tiene avisos de zona se ve igual) y `lib/enviarPush.js` (las claves VAPID se configuran al enviar, no al importar; ya funcionó en Preview).
- **Solo documentación y SQL de referencia** (ya aplicado en Supabase): `sql/079`-`083`, `docs/`, `legal/borradores/`, `PROGRESS.md`.

## Procedimiento (en este orden)
1. **Política de privacidad: aprobada y ya preparada en la rama.** `app/privacidad/page.js` incluye el texto nuevo, pero solo se muestra con `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` (salen a la vez la función y su política; sin la variable la política es la actual). Al lanzar, copiar el mismo texto a `legal/politica-privacidad.md`. Siguen pendientes de revisión legal: datos de localización, transferencias internacionales y privacidad de iOS (ver `legal/borradores/privacidad-avisos-zona.md`).
2. `sql/084` (espacios en el texto del aviso): **aplicado el 22-nov-2026**.
3. **Fusionar `prueba-avisos-zona` en `main`** (fusión directa) y esperar el despliegue. La función sigue oculta: la variable no está definida y los interruptores están apagados. Comprobar que la web carga, que la campana y un push existente funcionan (cambio de `enviarPush.js`) y que las reservas siguen bien.
4. **Mostrar la función:** en Vercel → Producción, definir `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` y redesplegar (las variables `NEXT_PUBLIC_` se incorporan al compilar). Los usuarios ya pueden configurar sus avisos; con los interruptores apagados aún no reciben nada.
5. **Comprobar el enlace del resumen en Producción** (obligatorio): con la sesión de Cl iniciada en `https://www.ruleafit.com`, abrir `/sesiones-en-mi-zona?r=2751d4c9-d6fc-4c20-acb3-44e29f146da5` (resumen de prueba conservado): debe mostrar «1 sesión nueva en tu zona» y la sesión A. Sin sesión iniciada debe pedir iniciar sesión, y con el id de otra persona no debe mostrar nada. Si falla, **no abrir los interruptores**.
6. **Abrir los interruptores** (una sola sentencia, con autorización):
   ```sql
   update public.config_avisos_zona
      set solo_usuarios_prueba = false, inmediatos_activos = true, resumen_activo = true;
   ```
   Mejor hacerlo antes de las 20:30 de Madrid, para que el primer resumen salga solo por el cron. No hay avisos retroactivos: solo cuentan las sesiones publicadas después de que cada usuario active su configuración (y el motor de inmediatos empieza al encender).
7. **Vigilar** (solo lectura), el mismo día y al siguiente:
   ```sql
   select public.avisos_zona_estado_motor(), public.avisos_zona_estado_resumen();
   select count(*) from public.avisos_zona_pendientes where estado in ('pendiente','agotado');
   select tipo, estado, count(*) from public.notificaciones_cola where tipo in ('sesion_zona','resumen_zona') group by 1, 2;
   ```
   Esperado: motor `ok`, 0 errores, avisos de la cola en `enviada` (los `error` son usuarios sin suscripción push válida y no son preocupantes).
8. **Cron de limpieza** (`sql/083_avisos_zona_mantenimiento_cron.sql`): **programarlo el día del lanzamiento** (la política de privacidad promete que los registros técnicos se eliminan en un máximo de 90 días, y eso lo hace este cron). Es diario (04:30 UTC), solo borra registros de control antiguos (y avisos de zona ya enviados de la cola) y no toca configuraciones ni notificaciones normales. No es urgente: sin él las tablas crecen despacio, pero no tiene ventaja esperar.

## Parada de emergencia (en cualquier momento, un solo `UPDATE`)
```sql
update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;
```
Para volver al modo prueba: añadir `solo_usuarios_prueba = true, usuarios_prueba = '{}'`. Para ocultar la interfaz: quitar `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES` en Vercel y redesplegar.

## Riesgos conocidos y decididos
- Si el cron del resumen falla más allá de las 22:30 de Madrid, ese día no se envía (decisión deliberada para no mandar avisos tardíos).
- Un usuario con 2 suscripciones push puede recibir el mismo aviso en 2 dispositivos.
- El push del iPhone nativo (app de Capacitor) sigue pendiente de la cuenta de Apple Developer; en la web/PWA funciona.
