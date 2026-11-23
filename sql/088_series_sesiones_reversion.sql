-- ============================================================================
-- Ruleafit · 088_series_sesiones_reversion.sql
-- Deshace C07: elimina las funciones de series, restaura limitar_envios() y
-- notificar_publicacion_clase() a su versión anterior y elimina la relación sesión → serie.
-- LAS SESIONES NO SE BORRAN: simplemente dejan de estar agrupadas en series (con sus reservas,
-- cobros e historial intactos). Se pierde solo la agrupación y el patrón guardado.
-- ============================================================================

drop function if exists public.publicar_serie(jsonb, jsonb);
drop function if exists public.previsualizar_cancelacion_serie(uuid, text);
drop function if exists public.cancelar_serie(uuid, text);
drop function if exists public.editar_serie(uuid, text, jsonb);
drop function if exists public.actualizar_patron_serie(uuid, jsonb, jsonb);
drop function if exists public.serie_sesiones_objetivo(uuid, text);
drop function if exists public.notificar_serie_publicada(uuid, text, integer, uuid, text);

drop trigger if exists trg_proteger_serie_id on public.clases;
drop function if exists public.proteger_serie_id();

drop index if exists public.clases_serie_idx;
alter table public.clases drop column if exists serie_id;
drop table if exists public.series_sesiones;

create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid         uuid := auth.uid();
  v_tabla       text := tg_table_name;
  v_col         text;
  v_max_hora    integer;
  v_max_dia     integer;
  v_hora        integer;
  v_dia         integer;
begin
  if v_uid is null then
    return new;
  end if;

  if v_tabla = 'feedback' then
    v_col := 'user_id';        v_max_hora := 5;   v_max_dia := 20;
  elsif v_tabla = 'denuncias' then
    v_col := 'denunciante_id'; v_max_hora := 10;  v_max_dia := 30;
  elsif v_tabla = 'clases' then
    v_col := 'trainer_id';     v_max_hora := 30;  v_max_dia := 100;
  else
    return new;
  end if;

  execute format(
    'select count(*) filter (where created_at > now() - interval ''1 hour''),
            count(*) filter (where created_at > now() - interval ''1 day'')
       from public.%I where %I = $1 and created_at > now() - interval ''1 day''',
    v_tabla, v_col
  ) into v_hora, v_dia using v_uid;

  if v_hora >= v_max_hora or v_dia >= v_max_dia then
    raise exception 'Has hecho demasiados envíos en poco tiempo. Inténtalo de nuevo más tarde.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_destinatario uuid;
begin
  -- Solo notificamos si la clase se crea activa.
  if new.estado is distinct from 'activa' then
    return new;
  end if;

  -- Nombre visible del autor.
  select username into v_username
  from public.perfiles
  where id = new.trainer_id;

  if v_username is null then
    v_username := 'Tu entrenador';
  end if;

  -- Una notificacion por cada usuario que tiene al autor en favoritos y no ha
  -- desactivado "Nuevas sesiones de mis ruleros favoritos" (categoria
  -- 'publicaciones'; sin fila = activa). Los seguidores que no lo tienen en
  -- favoritos NO reciben nada. Tampoco quien tenga un bloqueo con el autor.
  for v_destinatario in
    select f.usuario_id
    from public.favoritos f
    where f.favorito_id = new.trainer_id
      and coalesce(
            (select pn.activo
               from public.preferencias_notificaciones pn
              where pn.usuario_id = f.usuario_id
                and pn.categoria = 'publicaciones'),
            true
          )
      and not exists (
            select 1 from public.bloqueos b
             where (b.bloqueador_id = new.trainer_id and b.bloqueado_id = f.usuario_id)
                or (b.bloqueador_id = f.usuario_id and b.bloqueado_id = new.trainer_id))
  loop
    perform public.generar_notificacion(
      v_destinatario,
      'sesion_publicada',
      'Nueva sesion de ' || v_username,
      v_username || ' ha publicado: ' || new.titulo,
      '/clases/' || new.id::text
    );
  end loop;

  return new;
end;
$$;
