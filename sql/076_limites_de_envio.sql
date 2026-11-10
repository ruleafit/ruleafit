-- 076_limites_de_envio.sql
-- Auditoría 9-nov-2026, recomendación 4: límite de peticiones.
-- Un usuario con sesión podía enviar feedback, denuncias o publicar sesiones sin
-- límite (llenar la base de datos, o disparar miles de avisos al administrador).
-- Estos disparadores cuentan lo que el propio usuario ha creado en la última
-- hora / día y, si se pasa, rechazan el INSERT con un mensaje claro.
--
-- Los límites son holgados para uso real:
--   feedback : 5 por hora y 20 por día
--   denuncias: 10 por hora y 30 por día
--   clases   : 30 por hora y 100 por día (publicar y copiar sesiones)
--
-- Notas:
--  * SECURITY DEFINER porque el usuario no puede leer feedback ni todas las
--    denuncias (RLS) y el recuento daría siempre 0.
--  * Si auth.uid() es null (service role, panel de Supabase, funciones internas)
--    no se limita nada.
--  * Para ajustar un límite basta con cambiar el número y volver a ejecutar.

create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Es función de disparador: nadie necesita ejecutarla a mano ni por la API.
revoke all on function public.limitar_envios() from public, anon, authenticated;

drop trigger if exists trg_limitar_envios on public.feedback;
create trigger trg_limitar_envios
  before insert on public.feedback
  for each row execute function public.limitar_envios();

drop trigger if exists trg_limitar_envios on public.denuncias;
create trigger trg_limitar_envios
  before insert on public.denuncias
  for each row execute function public.limitar_envios();

drop trigger if exists trg_limitar_envios on public.clases;
create trigger trg_limitar_envios
  before insert on public.clases
  for each row execute function public.limitar_envios();

-- Verificación: deben aparecer 3 filas (feedback, denuncias, clases).
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_name = 'trg_limitar_envios'
order by event_object_table;
