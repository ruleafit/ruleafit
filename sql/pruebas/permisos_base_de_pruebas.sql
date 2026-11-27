-- ============================================================================
-- ⛔ SOLO PARA EL PROYECTO DE PRUEBAS (ixeuanoikjftpdgezfyz).
-- Ruleafit · permisos_base_de_pruebas.sql (GENERADO)
-- Los proyectos nuevos de Supabase ya no dan permisos sobre las tablas por defecto: la base de pruebas se quedó
-- sin ellos («permission denied for table ...»). Esto deja los mismos permisos que resultan de sql/ en un proyecto
-- como el de producción (las políticas RLS siguen mandando). Es repetible. Se detiene si parece producción.
-- ============================================================================
begin;
do $guarda$
begin
  if exists (select 1 from cron.job where command like '%ruleafit.com%') or (select count(*) from auth.users) > 10 then
    raise exception 'ALTO: esta base no parece la de pruebas. No se ha cambiado nada.';
  end if;
end;
$guarda$;

grant usage on schema public to anon, authenticated, service_role;
-- Para las tablas que se creen después con otros SQL:
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

grant select, insert, update, delete on public.alertas_operativas to service_role;
grant select on public.alertas_plaza to authenticated;
grant select, insert, update, delete on public.alertas_plaza to service_role;
grant select, insert, update, delete on public.archivo_fiscal to service_role;
grant select, insert, update, delete on public.avisos_organizador to service_role;
grant select, insert, update, delete on public.avisos_organizador_destinatarios to service_role;
grant select, insert, update, delete on public.avisos_plaza_enviados to service_role;
grant select, delete on public.avisos_zona to authenticated;
grant select, insert, update, delete on public.avisos_zona to service_role;
grant select, insert, update, delete on public.avisos_zona_inmediatos to service_role;
grant select, insert, update, delete on public.avisos_zona_motor to service_role;
grant select, insert, update, delete on public.avisos_zona_pendientes to service_role;
grant select, insert, update, delete on public.avisos_zona_procesadas to service_role;
grant select, insert, update, delete on public.avisos_zona_resumen_errores to service_role;
grant select, insert, update, delete on public.avisos_zona_resumen_motor to service_role;
grant select on public.avisos_zona_resumenes to authenticated;
grant select, insert, update, delete on public.avisos_zona_resumenes to service_role;
grant select, insert, update, delete on public.bloqueos to anon;
grant select, insert, update, delete on public.bloqueos to authenticated;
grant select, insert, update, delete on public.bloqueos to service_role;
grant select on public.bolsas to authenticated;
grant select, insert, update, delete on public.bolsas to service_role;
grant select, insert, update, delete on public.bonos to anon;
grant select, insert, update, delete on public.bonos to authenticated;
grant select, insert, update, delete on public.bonos to service_role;
grant select, insert, update, delete on public.bonos_clientes to anon;
grant select, insert, update, delete on public.bonos_clientes to authenticated;
grant select, insert, update, delete on public.bonos_clientes to service_role;
grant select, insert, delete on public.clases to anon;
grant select, insert, delete on public.clases to authenticated;
grant select, insert, update, delete on public.clases to service_role;
grant select on public.cobros to authenticated;
grant select, insert, update, delete on public.cobros to service_role;
grant select, insert, update, delete on public.codigos_invitacion to service_role;
grant select, insert, update, delete on public.config_avisos_zona to service_role;
grant select, insert, update, delete on public.config_pagos to service_role;
grant select, insert, update, delete on public.denuncias to anon;
grant select, insert, update, delete on public.denuncias to authenticated;
grant select, insert, update, delete on public.denuncias to service_role;
grant select, insert, update, delete on public.devoluciones to service_role;
grant select, insert, update, delete on public.episodios_plaza to service_role;
grant select, insert, delete on public.favoritos to authenticated;
grant select, insert, update, delete on public.favoritos to service_role;
grant select, insert, update, delete on public.feedback to anon;
grant select, insert, update, delete on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;
grant select on public.incidencias_pago to authenticated;
grant select, insert, update, delete on public.incidencias_pago to service_role;
grant select on public.incidencias_pago_eventos to authenticated;
grant select, insert, update, delete on public.incidencias_pago_eventos to service_role;
grant select, insert, update, delete on public.invitaciones to service_role;
grant select, insert, update, delete on public.invitaciones_abiertas to service_role;
grant select, insert, update, delete on public.liquidaciones to service_role;
grant select on public.liquidaciones_lineas to authenticated;
grant select, insert, update, delete on public.liquidaciones_lineas to service_role;
grant select on public.movimientos_bolsa to authenticated;
grant select, insert, update, delete on public.movimientos_bolsa to service_role;
grant select, insert, update, delete on public.notificaciones_cola to anon;
grant select, insert, update, delete on public.notificaciones_cola to authenticated;
grant select, insert, update, delete on public.notificaciones_cola to service_role;
grant select, insert, update, delete on public.notificaciones_historial to anon;
grant select, insert, update, delete on public.notificaciones_historial to authenticated;
grant select, insert, update, delete on public.notificaciones_historial to service_role;
grant select on public.perfil_privacidad to authenticated;
grant select, insert, update, delete on public.perfil_privacidad to service_role;
grant select, insert, update, delete on public.perfiles to anon;
grant select, insert, update, delete on public.perfiles to authenticated;
grant select, insert, update, delete on public.perfiles to service_role;
grant select, insert, update, delete on public.perfiles_fiscales to service_role;
grant select, insert, update, delete on public.preferencias_notificaciones to anon;
grant select, insert, update, delete on public.preferencias_notificaciones to authenticated;
grant select, insert, update, delete on public.preferencias_notificaciones to service_role;
grant select, insert, update, delete on public.push_subscriptions to anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.recordatorios_enviados to anon;
grant select, insert, update, delete on public.recordatorios_enviados to authenticated;
grant select, insert, update, delete on public.recordatorios_enviados to service_role;
grant select, insert, update, delete on public.reprogramacion_respuestas to service_role;
grant select, insert, update, delete on public.reprogramaciones to service_role;
grant select, insert, update, delete on public.reservas to anon;
grant select, insert, update, delete on public.reservas to authenticated;
grant select, insert, update, delete on public.reservas to service_role;
grant select, insert, update, delete on public.reservas_canceladas_por_bloqueo to service_role;
grant select, insert, update, delete on public.rulos_motivos to anon;
grant select, insert, update, delete on public.rulos_motivos to authenticated;
grant select, insert, update, delete on public.rulos_motivos to service_role;
grant select, insert, update, delete on public.rulos_movimientos to anon;
grant select, insert, update, delete on public.rulos_movimientos to authenticated;
grant select, insert, update, delete on public.rulos_movimientos to service_role;
grant select, insert, update, delete on public.rulos_saldos to anon;
grant select, insert, update, delete on public.rulos_saldos to authenticated;
grant select, insert, update, delete on public.rulos_saldos to service_role;
grant select, insert, update, delete on public.seguimientos to anon;
grant select, insert, update, delete on public.seguimientos to authenticated;
grant select, insert, update, delete on public.seguimientos to service_role;
grant select on public.series_sesiones to authenticated;
grant select, insert, update, delete on public.series_sesiones to service_role;
grant select, insert, update, delete on public.solicitudes_centros to service_role;
grant select, insert, update, delete on public.solicitudes_valoracion to service_role;
grant select, insert, update, delete on public.solicitudes_valoracion_config to service_role;
grant select, insert, update, delete on public.ubicaciones_habituales to authenticated;
grant select, insert, update, delete on public.ubicaciones_habituales to service_role;
grant select, insert, update, delete on public.valoraciones to anon;
grant select, insert, update, delete on public.valoraciones to authenticated;
grant select, insert, update, delete on public.valoraciones to service_role;
grant insert (usuario_id, activo, modo, zona_nombre, zona_lat, zona_lng, radio_km, categorias, hora_desde, hora_hasta) on public.avisos_zona to authenticated;
grant update (usuario_id, activo, modo, zona_nombre, zona_lat, zona_lng, radio_km, categorias, hora_desde, hora_hasta) on public.avisos_zona to authenticated;
grant insert (usuario_id, mostrar_arroba_participantes) on public.perfil_privacidad to authenticated;
grant update (mostrar_arroba_participantes) on public.perfil_privacidad to authenticated;
grant select (usuario_id, tipo, nombre_fiscal, tipo_documento, nif, direccion, codigo_postal, municipio, provincia, pais, zona_fiscal, email_facturas, titular_iban, iban_ultimos4, fecha_nacimiento, retencion_reducida, acepta_terminos_version, acepta_autofactura_version, declara_ingresos, responsable_datos, aceptado_en, estado, revisado_en, created_at, updated_at) on public.perfiles_fiscales to authenticated;
grant usage, select on sequence public.incidencias_pago_numero_seq to service_role;
grant usage, select on sequence public.movimientos_bolsa_id_seq to anon;
grant usage, select on sequence public.movimientos_bolsa_id_seq to authenticated;
grant usage, select on sequence public.movimientos_bolsa_id_seq to service_role;
commit;

-- Comprobación. Esperado: service_lee = tablas; anon_lee_cobros = false; auth_escribe_clases = false.
select count(*) as tablas,
       count(*) filter (where has_table_privilege('service_role', oid, 'select')) as service_lee,
       has_table_privilege('anon', 'public.cobros', 'select') as anon_lee_cobros,
       has_table_privilege('authenticated', 'public.clases', 'update') as auth_escribe_clases
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';
