# Prueba real controlada de «Avisos de sesiones en mi zona» (campana + push)

**Estado: preparada, NO ejecutada.** Cada bloque SQL necesita la autorización expresa del titular. Cuentas: `rubenpersonatEn` (En) y `rubenpersonatCl` (Cl). Proyecto Supabase `fjedrczlbyxevjuqqhra`. `sql/083` ya está aplicado (23-nov-2026).

## Diseño de la prueba (4 pasos, sin cambiar de modalidad)
Las dos cuentas se avisan entre sí, así que con **una sola activación** se prueban las dos modalidades:
- **En** recibe en modalidad **Inmediata** cuando Cl publica una sesión (campana + push).
- **Cl** (que ya tiene configurado «Resumen diario», Sevilla 5 km, Cardio) recibe el **resumen** cuando En publica una sesión.

Estado comprobado antes de empezar: En tiene 1 suscripción push y aún no tiene configuración; Cl tiene 2 suscripciones push y su configuración activa; ninguno tiene al otro en Favoritos ni hay bloqueos; Cl es el único usuario con avisos activos; interruptores apagados.

## Garantías de aislamiento
- `solo_usuarios_prueba = true` y `usuarios_prueba = {En, Cl}`: ningún otro usuario puede recibir avisos de zona, aunque active la función. Lo comprueban dos puertas independientes (evaluación y, otra vez, dentro de `generar_aviso_zona` / `generar_resumen_zona`).
- Comprobación final obligatoria (paso 4): 0 avisos de zona para cualquier otro usuario.
- Parada de emergencia al final de este documento.

## Paso 1 · En configura sus avisos (web, sin SQL)
En el **Preview** de `prueba-avisos-zona` (la sección solo existe ahí), con En: Mi cuenta → «Avisos de sesiones en mi zona» → activar, zona Sevilla (Plaza de España), radio 5 km, categoría **Cardio**, franja completa, modalidad **Inmediata**. Guardar. Comprobar que En y Cl tienen las notificaciones push activadas en los móviles donde van a mirar. (Cl tiene 2 suscripciones Apple: el push puede llegar a dos dispositivos; no es un fallo.)

## Paso 2 · Activar (SQL, una sola vez)
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

## Paso 3 · Publicar y comprobar (las dos sesiones, gratuitas, Cardio, Sevilla, que empiecen dentro de 40-60 h, título «PRUEBA interna, no reservar»)
**3a · Inmediata.** Cl publica una sesión. En 1-2 minutos, En debe ver 1 aviso en la campana («Nueva sesión cerca de ti»), recibir 1 push y, al tocarlo, abrirse la sesión.

**3b · Resumen.** En publica otra sesión. Lanzar el resumen a mano (equivale a las 20:35 de hoy; entre las 20:30 y las 22:30 de Madrid lo haría solo el cron):
```sql
select public.procesar_avisos_zona_resumen(((now() at time zone 'Europe/Madrid')::date + time '20:35') at time zone 'Europe/Madrid');
```
Esperado: `resumenes_enviados = 1`. Cl ve en la campana «Nuevas sesiones cerca de ti: 1 sesión nueva en tu zona» (el resumen recoge las sesiones de las últimas 24 h que encajan: solo la de En, porque la de Cl es suya), recibe el push y, al tocarlo, se abre `/sesiones-en-mi-zona?r=…` con la sesión. Repetir la llamada no genera un segundo resumen.

Consultas de comprobación:
```sql
select u.username, h.tipo, h.titulo, h.cuerpo, h.url, h.created_at
  from public.notificaciones_historial h join public.perfiles u on u.id = h.usuario_id
 where h.tipo in ('sesion_zona', 'resumen_zona') order by h.created_at desc;
select tipo, estado, intentos from public.notificaciones_cola where tipo in ('sesion_zona', 'resumen_zona') order by created_at desc;
select public.avisos_zona_estado_motor(), public.avisos_zona_estado_resumen();
```

## Paso 4 · Apagar, limpiar y comprobar aislamiento
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
Cl y En cancelan sus sesiones de prueba desde la web (comprobar que tienen 0 reservas).

## Parada de emergencia (en cualquier momento)
```sql
update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;
```
Además se pueden dar de baja los crons con `sql/081_avisos_zona_inmediatos_cron_baja.sql` y `sql/082_avisos_zona_resumen_cron_baja.sql`.

## Lanzamiento público (tras la prueba, con autorización)
1. Política de privacidad aprobada y publicada (`legal/borradores/privacidad-avisos-zona.md`).
2. (Opcional) cron de limpieza `sql/083_avisos_zona_mantenimiento_cron.sql`.
3. `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` en Producción de Vercel y llevar la rama a `main`.
4. `update public.config_avisos_zona set solo_usuarios_prueba = false, inmediatos_activos = true, resumen_activo = true;`
5. Desactivar = el UPDATE de parada de emergencia.
