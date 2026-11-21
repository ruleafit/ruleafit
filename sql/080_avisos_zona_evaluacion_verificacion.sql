-- ============================================================================
-- Ruleafit · 080_avisos_zona_evaluacion_verificacion.sql
-- Para ejecutar DESPUÉS de aplicar sql/080_avisos_zona_evaluacion.sql.
-- SOLO LECTURA. Una única consulta con una fila por comprobación; todas deben
-- tener ok = true. (La consulta opcional del final se ejecuta por separado.)
--
-- Las filas del grupo 4 comparan con la huella (md5) de las funciones existentes el
-- 21 nov 2026, antes de la Fase 3.
-- ============================================================================

select orden, comprobacion, obtenido, esperado, (obtenido = esperado) as ok
from (

  -- 1) La función existe, es de solo lectura y está blindada
  select 1 as orden, 'Existe avisos_zona_evaluar' as comprobacion,
         count(*)::text as obtenido, '1' as esperado
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'
  union all
  select 1, 'Es STABLE (no puede escribir datos)', p.provolatile::text, 's'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'
  union all
  select 1, 'Es SECURITY DEFINER', p.prosecdef::text, 'true'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'
  union all
  select 1, 'search_path fijo',
         (p.proconfig is not null
          and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))::text, 'true'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'

  -- 2) Permisos: solo la clave de servicio
  union all
  select 2, 'anon no puede ejecutarla',
         has_function_privilege('anon', p.oid, 'execute')::text, 'false'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'
  union all
  select 2, 'authenticated no puede ejecutarla',
         has_function_privilege('authenticated', p.oid, 'execute')::text, 'false'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'
  union all
  select 2, 'service_role sí puede ejecutarla',
         has_function_privilege('service_role', p.oid, 'execute')::text, 'true'
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'avisos_zona_evaluar'

  -- 3) Sigue todo apagado y sin procesos nuevos
  union all select 3, 'Interruptor global: inmediatos apagados',
         inmediatos_activos::text, 'false' from public.config_avisos_zona
  union all select 3, 'Interruptor global: resumen apagado',
         resumen_activo::text, 'false' from public.config_avisos_zona
  union all
  select 3, 'Crons de avisos de zona', count(*)::text, '0'
    from cron.job where jobname ilike '%avisos%'
  union all
  select 3, 'Funciones de envío de avisos de zona', count(*)::text, '0'
    from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('generar_aviso_zona', 'procesar_avisos_zona_inmediatos', 'enviar_resumenes_zona')
  union all
  select 3, 'Triggers de avisos en public.clases', count(*)::text, '0'
    from pg_trigger t
   where t.tgrelid = 'public.clases'::regclass and not t.tgisinternal and t.tgname ilike '%avisos%'
  union all select 3, 'Notificaciones de zona en cola', count(*)::text, '0'
    from public.notificaciones_cola where tipo like '%zona%'
  union all select 3, 'Notificaciones de zona en historial', count(*)::text, '0'
    from public.notificaciones_historial where tipo like '%zona%'

  -- 4) Funciones EXISTENTES intactas
  union all
  select 4, 'Sin cambios: ' || p.proname, md5(pg_get_functiondef(p.oid)), e.md5
    from pg_proc p
    join (values
      ('autocancelar_clases_sin_minimo', 'b2f7610d68c7b2873f486b6f92030759'),
      ('cancelar_clase',                 '5e9dcca65397ff7c92d1363e5aa3e4a5'),
      ('cancelar_reserva',               '08f3a5dd91c2283a991cc53dfe8a4362'),
      ('generar_notificacion',           '111e8b5bab94cee59736c57fbffb5296'),
      ('impedir_reserva_si_bloqueado',   '887952e542d411b90ae6d9e0f435b810'),
      ('notificar_publicacion_clase',    '38f70675f0e3a6b444d07d47eb93d11a'),
      ('procesar_recordatorios',         'f9d3e448bdfa891f177d0888dce2a4dc'),
      ('purgar_notificaciones_historial','4341c2cc5ce7845f32345655c5a40772'),
      ('reservar_clase',                 '843591d994ce30fac5d051afe5e44cbc')
    ) as e(proname, md5) on e.proname = p.proname
   where p.pronamespace = 'public'::regnamespace

  -- 5) Funcionamiento básico (una sesión que no existe no devuelve nada)
  union all
  select 5, 'Sesión inexistente: 0 filas',
         (select count(*) from public.avisos_zona_evaluar('00000000-0000-0000-0000-000000000000'::uuid, now(), true))::text,
         '0'

) comprobaciones
order by orden, comprobacion;


-- ----------------------------------------------------------------------------
-- OPCIONAL (ejecutar por separado): qué pasaría hoy con cada sesión activa y
-- futura si se acabara de publicar. Solo lectura. Muestra el motivo para cada
-- usuario con avisos activados (hoy, solo quien los haya configurado).
-- ----------------------------------------------------------------------------
-- select c.titulo, c.fecha, c.hora, e.resultado, round(e.distancia_km::numeric, 1) as km, e.modo, e.habilitado
--   from public.clases c
--  cross join lateral public.avisos_zona_evaluar(c.id, now(), true) e
--  where c.estado = 'activa'
--    and public.avisos_zona_inicio_sesion(c.fecha, c.hora) > now()
--  order by c.fecha, c.hora;
