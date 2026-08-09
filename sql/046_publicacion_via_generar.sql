-- 046_publicacion_via_generar.sql
-- Reconvierte notificar_publicacion_clase (sql/037) para que use la funcion
-- helper generar_notificacion (sql/045) en vez de insertar directo en la cola.
-- Asi cada seguidor obtiene: (1) fila en notificaciones_historial SIEMPRE, y
-- (2) push solo si su preferencia de la categoria 'publicaciones' esta activa.
-- Unico cambio de forma: el insert...select masivo pasa a un bucle que llama
-- a generar_notificacion una vez por seguidor. El trigger no cambia.

create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_seguidor uuid;
begin
  -- Solo notificamos si la clase se crea activa.
  if new.estado is distinct from 'activa' then
    return new;
  end if;

  -- Nombre visible del entrenador.
  select username into v_username
  from public.perfiles
  where id = new.trainer_id;

  if v_username is null then
    v_username := 'Tu entrenador';
  end if;

  -- Una notificacion por cada seguidor, via generar_notificacion
  -- (historial siempre + push segun preferencia).
  for v_seguidor in
    select s.seguidor_id
    from public.seguimientos s
    where s.entrenador_id = new.trainer_id
  loop
    perform public.generar_notificacion(
      v_seguidor,
      'sesion_publicada',
      'Nueva sesion de ' || v_username,
      v_username || ' ha publicado: ' || new.titulo,
      '/clases/' || new.id::text
    );
  end loop;

  return new;
end;
$$;
