-- Reversión de 112. ATENCIÓN: borra las verificaciones de centro.
-- Ejecutarla antes que las de 111 y 110 y tras retirar de la web esta versión.

drop function if exists public.resolver_verificacion_centro(uuid, text, text, uuid);
drop function if exists public.centro_publico(uuid);
drop function if exists public.retirar_verificacion_centro();
drop function if exists public.enviar_verificacion_centro(text, text, text, text);

-- Encola los documentos de centro antes de borrar la tabla.
delete from public.verificaciones_centro;
drop table if exists public.verificaciones_centro;
drop function if exists public.recalcular_insignia_centro();
drop function if exists public.trg_centro_archivos();

drop index if exists public.verificaciones_identidad_documento;
alter table public.verificaciones_identidad
  drop column if exists metodo,
  drop column if exists analizado_en,
  drop column if exists documento_hash;

-- Versiones de 110.
create or replace function public.proteger_insignias_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.identidad_verificada := false;
      new.titulacion_acreditada := false;
    elsif new.identidad_verificada is distinct from old.identidad_verificada
       or new.titulacion_acreditada is distinct from old.titulacion_acreditada then
      raise exception 'Las insignias de verificación no se pueden modificar.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.encolar_huerfanos_verificacion()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into public.archivos_verificacion_por_borrar (bucket, ruta)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id in ('verificaciones-identidad', 'titulaciones')
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.verificaciones_identidad v
                      where o.bucket_id = 'verificaciones-identidad'
                        and (v.ruta_anverso = o.name or v.ruta_reverso = o.name))
     and not exists (select 1 from public.titulaciones t
                      where o.bucket_id = 'titulaciones' and t.ruta = o.name)
  on conflict (bucket, ruta) do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

alter table public.perfiles drop column if exists centro_verificado;
