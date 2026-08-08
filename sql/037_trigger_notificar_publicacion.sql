-- 037_trigger_notificar_publicacion.sql
-- Cuando un entrenador publica una sesion nueva (INSERT en clases con estado
-- 'activa'), se inserta una notificacion en notificaciones_cola para cada uno
-- de sus seguidores. La funcion es SECURITY DEFINER para poder escribir en la
-- cola (que tiene RLS sin policies). Un cron procesara la cola y enviara las push.

create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
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

  -- Insertar una notificacion por cada seguidor de este entrenador.
  insert into public.notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
  select
    s.seguidor_id,
    'sesion_publicada',
    'Nueva sesion de ' || v_username,
    v_username || ' ha publicado: ' || new.titulo,
    '/clases/' || new.id::text
  from public.seguimientos s
  where s.entrenador_id = new.trainer_id;

  return new;
end;
$$;

-- Trigger: se dispara despues de insertar una clase.
drop trigger if exists trg_notificar_publicacion on public.clases;
create trigger trg_notificar_publicacion
  after insert on public.clases
  for each row
  execute function public.notificar_publicacion_clase();
