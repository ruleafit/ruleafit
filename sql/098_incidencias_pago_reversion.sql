-- Reversión de 098. BORRA los casos registrados: hacer copia antes si hay alguno real.
drop function if exists public.actualizar_incidencia(uuid, text, text);
drop function if exists public.abrir_incidencia(uuid, text, text);
drop function if exists public.mis_reservas_reclamables();
drop table if exists public.incidencias_pago_eventos;
drop table if exists public.incidencias_pago;
drop function if exists public.incidencias_pago_anonimizar();
drop sequence if exists public.incidencias_pago_numero_seq;
