-- ============================================================================
-- Ruleafit · 074_cerrar_funciones_internas.sql
-- Cierra el acceso desde fuera a las funciones que solo deben usar la propia
-- base de datos (otras funciones, triggers y tareas programadas).
--
-- QUÉ PASABA (auditoría del 9 noviembre 2026): en Supabase, las funciones nuevas
-- del esquema public se crean ya con permiso de ejecución para "anon" y
-- "authenticated". Un "REVOKE ... FROM public" NO quita esos permisos, así que
-- cualquiera con la clave pública de la web (la que viaja en el navegador)
-- podía llamar a estas funciones, sin iniciar sesión:
--   - otorgar_rulos(...)         -> darse (o dar a otros) Rulos sin límite.
--   - generar_notificacion(...)  -> mandar notificaciones push y avisos del
--                                    historial a cualquier usuario, con el título,
--                                    texto y enlace que quisiera (phishing).
--   - y, por el mismo motivo, el resto de funciones internas de abajo.
-- Comprobado con una sonda inofensiva (cantidad 0): otorgar_rulos respondió
-- "La cantidad de Rulos no puede ser cero" (se ejecutaba) y generar_notificacion
-- respondió 204.
--
-- QUÉ NO SE ROMPE: todas las llamadas internas vienen de funciones SECURITY
-- DEFINER (se ejecutan con los permisos del dueño) o de pg_cron (corre como
-- postgres), y la web nunca las llama directamente (comprobado en el código).
-- Los triggers no comprueban este permiso al dispararse.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

revoke all on function public.otorgar_rulos(uuid, integer, text, text, uuid, uuid, text)
  from public, anon, authenticated;

revoke all on function public.generar_notificacion(uuid, text, text, text, text)
  from public, anon, authenticated;

revoke all on function public.procesar_recordatorios()
  from public, anon, authenticated;

revoke all on function public.autocancelar_clases_sin_minimo()
  from public, anon, authenticated;

revoke all on function public.completar_asistencia_clases_pasadas()
  from public, anon, authenticated;

revoke all on function public.purgar_notificaciones_historial()
  from public, anon, authenticated;

revoke all on function public.otorgar_rulos_clase_completada()
  from public, anon, authenticated;

revoke all on function public.generar_username_desde_email(text)
  from public, anon, authenticated;

revoke all on function public.username_disponible_o_sufijo(text)
  from public, anon, authenticated;

-- El servidor (clave de servicio) y el dueño siguen pudiendo ejecutarlas.
grant execute on function public.otorgar_rulos(uuid, integer, text, text, uuid, uuid, text) to service_role;
grant execute on function public.generar_notificacion(uuid, text, text, text, text) to service_role;
grant execute on function public.procesar_recordatorios() to service_role;
grant execute on function public.autocancelar_clases_sin_minimo() to service_role;
grant execute on function public.completar_asistencia_clases_pasadas() to service_role;
grant execute on function public.purgar_notificaciones_historial() to service_role;
grant execute on function public.otorgar_rulos_clase_completada() to service_role;

-- ----------------------------------------------------------------------------
-- Comprobación: debe devolver "false" en las 3 columnas para las 9 funciones.
-- (Ejecútala después y pásame el resultado.)
-- ----------------------------------------------------------------------------
select
  p.proname as funcion,
  has_function_privilege('anon', p.oid, 'execute')          as anon_puede,
  has_function_privilege('authenticated', p.oid, 'execute') as autenticado_puede,
  has_function_privilege('public', p.oid, 'execute')        as public_puede
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'otorgar_rulos', 'generar_notificacion', 'procesar_recordatorios',
    'autocancelar_clases_sin_minimo', 'completar_asistencia_clases_pasadas',
    'purgar_notificaciones_historial', 'otorgar_rulos_clase_completada',
    'generar_username_desde_email', 'username_disponible_o_sufijo'
  )
order by p.proname;
