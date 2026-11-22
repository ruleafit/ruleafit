# Prueba real controlada de «Avisos de sesiones en mi zona» (campana + push)

**Estado: preparada, NO ejecutada.** Cada bloque SQL necesita la autorización expresa del titular. Cuentas: `rubenpersonatEn` (En) y `rubenpersonatCl` (Cl). Proyecto Supabase `fjedrczlbyxevjuqqhra`. `sql/083` ya está aplicado.

## Hallazgo que cambia el diseño (comprobado en solo lectura el 22-nov-2026)
**En tiene a Cl en Favoritos** (y la preferencia «publicaciones» está activa por defecto). Por diseño, cuando Cl publica, En recibe el aviso normal de favoritos y el sistema de zona **no** le avisa (es la regla anti-duplicado). Por tanto **En no puede ser receptor de avisos de zona de Cl**. Cl sí puede serlo de En (Cl solo tiene a `lealfj1` en Favoritos). Receptor de la prueba: **Cl**; publicador: **En**. Como Cl es una sola cuenta, se prueba una modalidad detrás de otra (un cambio de modalidad en la web). No se modifica ningún dato de las cuentas por SQL.

Estado actual: En → Inmediata, Sevilla (Plaza de España) 5 km, Cardio, todo el día (1 push). Cl → Resumen diario, misma zona/radio/categoría (2 push). Sin bloqueos. Interruptores apagados, modo prueba activo, lista vacía. 0 avisos de zona. Las sesiones actuales de En (Málaga, Fuerza) y de Cl no interfieren.

## Garantías de aislamiento
- `solo_usuarios_prueba = true` y `usuarios_prueba = {En, Cl}`: ningún otro usuario puede recibir avisos de zona (doble comprobación: evaluación y de nuevo dentro de `generar_aviso_zona` / `generar_resumen_zona`). Hoy solo En y Cl tienen avisos activos.
- Comprobación final obligatoria (paso 6): 0 avisos de zona para cualquier otro usuario.
- Si algún usuario real publica una sesión Cardio a ≤ 5 km de Plaza de España durante la prueba, Cl también recibirá su aviso (es correcto y es solo para Cl); por eso el resumen puede contar más de 1 sesión.

## Paso 1 · Activar (SQL, una vez)
```sql
do $$
declare v uuid[];
begin
  select array_agg(id) into v from public.perfiles where username in ('rubenpersonatEn', 'rubenpersonatCl');
  if coalesce(cardinality(v), 0) <> 2 then raise exception 'No se encuentran exactamente las 2 cuentas de prueba'; end if;
  if (select count(*) from public.avisos_zona where activo) > 2 then raise exception 'Hay mas de 2 usuarios con avisos activos: revisar antes'; end if;
  update public.config_avisos_zona
     set solo_usuarios_prueba = true, usuarios_prueba = v, inmediatos_activos = true, resumen_activo = true;
end $$;
```

## Paso 2 · Resumen diario (Cl ya está en «Resumen diario»)
En publica la **sesión A**: gratuita, categoría **Cardio**, **Sevilla** (a menos de 5 km de Plaza de España; sirve el mismo lugar de las sesiones de Cl), que empiece dentro de **40-60 h**, título «PRUEBA A interna, no reservar».
Después se lanza el resumen a mano (antes de las 20:30 de Madrid se simula el de las 20:35 de hoy; después de las 20:30, el de mañana, que ya incluye lo publicado hoy):
```sql
select public.procesar_avisos_zona_resumen(
  case when (now() at time zone 'Europe/Madrid')::time < time '20:30'
       then ((now() at time zone 'Europe/Madrid')::date + time '20:35') at time zone 'Europe/Madrid'
       else (((now() at time zone 'Europe/Madrid')::date + 1) + time '20:35') at time zone 'Europe/Madrid' end);
```
Esperado: `resumenes_enviados = 1`. Cl ve en la campana «Nuevas sesiones cerca de ti — 1 sesión nueva en tu zona. Toca para verla.», recibe el push y, al tocarlo, se abre `/sesiones-en-mi-zona?r=…` con la sesión A. Repetir la llamada no genera otro resumen.

## Paso 3 · Cl cambia a «Inmediata» (web, Preview)
Mi cuenta → Avisos → modalidad **Inmediata** → Guardar (reinicia su `activo_desde`: solo cuentan las sesiones publicadas a partir de ahora).

## Paso 4 · Aviso inmediato
En publica la **sesión B** (mismas condiciones que la A, título «PRUEBA B interna, no reservar»). En 1-2 minutos Cl debe ver 1 aviso en la campana «Nueva sesión cerca de ti — … (de @rubenpersonatEn)», recibir 1 push y, al tocarlo, abrirse la sesión B.

(Opcional, comprueba el anti-duplicado de favoritos: Cl publica una sesión y En recibe SOLO el aviso normal de favoritos, ningún aviso de zona.)

## Paso 5 · Comprobación (solo lectura)
```sql
select u.username, h.tipo, h.titulo, h.cuerpo, h.url, h.created_at
  from public.notificaciones_historial h join public.perfiles u on u.id = h.usuario_id
 where h.tipo in ('sesion_zona', 'resumen_zona') order by h.created_at desc;
select tipo, estado, intentos from public.notificaciones_cola where tipo in ('sesion_zona', 'resumen_zona') order by created_at desc;
select public.avisos_zona_estado_motor(), public.avisos_zona_estado_resumen();
```

## Paso 6 · Apagar y comprobar aislamiento
```sql
update public.config_avisos_zona
   set inmediatos_activos = false, resumen_activo = false, solo_usuarios_prueba = true, usuarios_prueba = '{}';

select count(*) as avisos_a_otros_usuarios   -- debe ser 0
  from public.notificaciones_historial
 where tipo in ('sesion_zona', 'resumen_zona')
   and usuario_id not in (select id from public.perfiles where username in ('rubenpersonatEn', 'rubenpersonatCl'));
select inmediatos_activos, resumen_activo, solo_usuarios_prueba, cardinality(usuarios_prueba)
  from public.config_avisos_zona;   -- false, false, true, 0
```
Limpieza (con autorización): En cancela las sesiones A y B desde la web (0 reservas). Si el resumen se lanzó con la fecha de mañana, borrar su fila para que no bloquee el resumen real de ese día:
`delete from public.avisos_zona_resumenes where usuario_id in (select id from public.perfiles where username in ('rubenpersonatEn','rubenpersonatCl'));`
Cl vuelve a «Resumen diario» o desactiva su configuración si lo desea.

## Parada de emergencia (en cualquier momento)
```sql
update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;
```
Además se pueden dar de baja los crons con `sql/081_avisos_zona_inmediatos_cron_baja.sql` y `sql/082_avisos_zona_resumen_cron_baja.sql`.

## Lanzamiento público (tras la prueba, con autorización)
1. Política de privacidad aprobada y publicada (`legal/borradores/privacidad-avisos-zona.md`).
2. (Opcional) cron de limpieza `sql/083_avisos_zona_mantenimiento_cron.sql`.
3. `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` en Producción de Vercel y llevar la rama a `main`. **Orden obligatorio: la página `/sesiones-en-mi-zona` debe estar ya en Producción (fusión a `main` desplegada) ANTES de abrir los interruptores**: las notificaciones push del resumen abren `www.ruleafit.com/sesiones-en-mi-zona`, que hoy da 404 en Producción (comprobado el 22-nov-2026).
4. `update public.config_avisos_zona set solo_usuarios_prueba = false, inmediatos_activos = true, resumen_activo = true;`
5. Desactivar = el UPDATE de parada de emergencia.
