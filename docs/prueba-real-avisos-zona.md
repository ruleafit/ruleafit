# Prueba real controlada de «Avisos de sesiones en mi zona» (campana + push)

**Estado: preparada, NO ejecutada.** Cada bloque SQL necesita la autorización expresa del titular. Cuentas: organizador `rubenpersonatEn`, receptor `rubenpersonatCl`. Proyecto Supabase `fjedrczlbyxevjuqqhra`.

## Garantías de aislamiento
- `solo_usuarios_prueba = true` y `usuarios_prueba = {En, Cl}`: **ningún otro usuario puede recibir avisos de zona**, aunque tenga la función activada. Lo comprueban dos puertas independientes (`avisos_zona_habilitado` en la evaluación y otra vez dentro de `generar_aviso_zona` / `generar_resumen_zona`).
- Un único `UPDATE` enciende y otro apaga; los crons ya existen y solo actúan si el interruptor está encendido.
- Comprobación final obligatoria (paso 5): 0 avisos de zona para cualquier usuario fuera de la lista.

## Preparación (sin tocar Supabase)
1. Entrar con Cl en el **Preview** de `prueba-avisos-zona` (la sección «Avisos de sesiones en mi zona» solo existe ahí). Activarla: zona Sevilla, radio 20 km, categoría Cardio, franja completa, modalidad **Inmediata**. Guardar.
2. Cl **no** debe tener a En en Favoritos (si lo tiene, el aviso lo da el trigger de favoritos, que es lo correcto, pero no probaría la función nueva).
3. Cl debe tener las notificaciones push activadas en el dispositivo donde mirará. Cl tiene 2 suscripciones Apple: puede llegar el push a dos dispositivos; no es un fallo.

## Paso 1 · Activar inmediatos (solo En y Cl)
```sql
do $$
declare v uuid[];
begin
  select array_agg(id) into v from public.perfiles where username in ('rubenpersonatEn', 'rubenpersonatCl');
  if coalesce(cardinality(v), 0) <> 2 then raise exception 'No se encuentran exactamente las 2 cuentas de prueba'; end if;
  update public.config_avisos_zona
     set solo_usuarios_prueba = true, usuarios_prueba = v, inmediatos_activos = true;
end $$;
```

## Paso 2 · Aviso inmediato
En publica en la web una sesión **gratuita**, categoría Cardio, en Sevilla, que empiece dentro de 40-60 h, titulada «PRUEBA interna, no reservar». Esperar 1-2 minutos (el motor corre cada minuto y espera 60 s).
Esperado: 1 aviso en la campana de Cl «Nueva sesión cerca de ti», 1 push, y al tocarlo se abre la sesión.
```sql
select u.username, h.tipo, h.titulo, h.cuerpo, h.url, h.created_at
  from public.notificaciones_historial h join public.perfiles u on u.id = h.usuario_id
 where h.tipo in ('sesion_zona', 'resumen_zona') order by h.created_at desc;
select tipo, estado, intentos from public.notificaciones_cola where tipo in ('sesion_zona', 'resumen_zona') order by created_at desc;
select public.avisos_zona_estado_motor();
```

## Paso 3 · Resumen diario
1. Cl cambia su modalidad a **Resumen diario** en el Preview (reinicia `activo_desde`: solo cuentan las sesiones publicadas después).
2. En publica una **segunda** sesión de prueba (mismas condiciones).
3. Encender el resumen y lanzarlo a mano (equivale a las 20:35 de hoy; entre las 20:30 y las 22:30 de Madrid el cron lo haría solo):
```sql
update public.config_avisos_zona set resumen_activo = true;
select public.procesar_avisos_zona_resumen(((now() at time zone 'Europe/Madrid')::date + time '20:35') at time zone 'Europe/Madrid');
```
Esperado: `resumenes_enviados = 1`; en la campana de Cl «Nuevas sesiones cerca de ti: 1 sesión nueva en tu zona»; al tocarlo se abre `/sesiones-en-mi-zona?r=…` con la sesión. Repetir la llamada no genera un segundo resumen.

## Paso 4 · Apagar y limpiar
```sql
update public.config_avisos_zona
   set inmediatos_activos = false, resumen_activo = false, solo_usuarios_prueba = true, usuarios_prueba = '{}';
```
En cancela las sesiones de prueba desde la web (comprobar que tienen 0 reservas). Cl desactiva su configuración si quiere.

## Paso 5 · Comprobación de aislamiento y estado final
```sql
select count(*) as avisos_a_otros_usuarios   -- debe ser 0
  from public.notificaciones_historial
 where tipo in ('sesion_zona', 'resumen_zona')
   and usuario_id not in (select id from public.perfiles where username in ('rubenpersonatEn', 'rubenpersonatCl'));
select inmediatos_activos, resumen_activo, solo_usuarios_prueba, cardinality(usuarios_prueba)
  from public.config_avisos_zona;   -- false, false, true, 0
```

## Parada de emergencia (en cualquier momento)
```sql
update public.config_avisos_zona set inmediatos_activos = false, resumen_activo = false;
```
Además se pueden dar de baja los crons con `sql/081_avisos_zona_inmediatos_cron_baja.sql` y `sql/082_avisos_zona_resumen_cron_baja.sql`.

## Lanzamiento público (tras la prueba, con autorización)
1. Política de privacidad aprobada y publicada (`legal/borradores/privacidad-avisos-zona.md`).
2. Instalar `sql/083` (historial y limpieza) y, si se quiere, su cron `avisos-zona-purga`.
3. `NEXT_PUBLIC_AVISOS_ZONA_VISIBLES=true` en Producción de Vercel y desplegar la rama en `main`.
4. `update public.config_avisos_zona set solo_usuarios_prueba = false, inmediatos_activos = true, resumen_activo = true;`
5. Desactivar = el UPDATE de parada de emergencia.
