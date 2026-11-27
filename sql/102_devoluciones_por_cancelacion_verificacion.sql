-- Verificación de 102 (solo lectura).
-- 1) Dos triggers.
select tgname, tgrelid::regclass as tabla from pg_trigger
 where tgname in ('trg_devoluciones_sesion_cancelada', 'trg_exigir_perfil_fiscal_aprobado') order by 1;
-- 2) Sin cobros pagados de sesiones canceladas. Esperado: 0.
select count(*) as sin_marcar from public.cobros co join public.clases cl on cl.id = co.clase_id
 where cl.estado = 'cancelada' and co.estado = 'pagado';
-- 3) Funciones actualizadas. Esperado: true, true.
select (select prosrc like '%incidencias_pago%' from pg_proc where oid = 'public.eliminar_mi_cuenta()'::regprocedure) as borrado_mira_reclamaciones,
       (select prosrc like '%ceuta_melilla%' from pg_proc where pronamespace = 'public'::regnamespace and proname = 'guardar_perfil_fiscal') as revisa_zonas_especiales;
-- 4) Perfiles pendientes de revisión manual.
select usuario_id, nombre_fiscal, zona_fiscal, updated_at from public.perfiles_fiscales where estado = 'pendiente_revision' order by updated_at;
