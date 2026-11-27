-- Reversión de 110. ATENCIÓN: borra las solicitudes y titulaciones guardadas.
-- Antes de ejecutarla, retirar de la web la versión que usa las insignias.
-- Los buckets y sus archivos se eliminan desde el panel de Supabase (Storage):
-- Supabase no permite borrar archivos con SQL.

drop policy if exists "verificaciones: subir a la carpeta propia" on storage.objects;
drop function if exists public.puede_subir_verificacion();

drop trigger if exists trg_perfiles_insignias on public.perfiles;
drop function if exists public.proteger_insignias_perfil();

drop function if exists public.encolar_huerfanos_verificacion();
drop function if exists public.resolver_titulacion(uuid, text, text, uuid);
drop function if exists public.resolver_verificacion_identidad(uuid, text, text, uuid, text);
drop function if exists public.titulaciones_publicas(uuid);
drop function if exists public.retirar_titulacion(uuid);
drop function if exists public.enviar_titulacion(text, text, integer, text, text);
drop function if exists public.retirar_verificacion_identidad();
drop function if exists public.enviar_verificacion_identidad(text, text, text, text);
drop function if exists public.comprobar_archivo_verificacion(text, text, uuid);

drop table if exists public.titulaciones;
drop table if exists public.verificaciones_identidad;
drop table if exists public.archivos_verificacion_por_borrar;

drop function if exists public.recalcular_insignias();
drop function if exists public.trg_titulacion_archivos();
drop function if exists public.trg_identidad_archivos();
drop function if exists public.encolar_borrado_verificacion(text, text);

alter table public.perfiles
  drop column if exists identidad_verificada,
  drop column if exists titulacion_acreditada;
