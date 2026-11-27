-- ============================================================================
-- Ruleafit · 111_titulacion_declarada_denuncias.sql
-- «Titulación declarada» desde que se sube (sin documento visible hasta la
-- revisión) y denuncias de titulaciones.
--
-- Requiere 068 (denuncias) y 110. Independiente de los pagos. No redefine
-- ninguna función. Repetible.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Titulaciones que se enseñan: declaradas (pendientes) y acreditadas.
--    Nunca la ruta. titulaciones_publicas() (110) sigue devolviendo solo las
--    aprobadas y es la que decide quién puede ver un documento.
-- ----------------------------------------------------------------------------
create or replace function public.titulaciones_visibles(p_usuario uuid)
returns table (id uuid, nombre text, entidad text, anio integer, estado text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.nombre, t.entidad, t.anio, t.estado
    from public.titulaciones t
   where t.usuario_id = p_usuario
     and t.estado in ('pendiente', 'aprobada')
     and not public.me_ha_bloqueado(t.usuario_id)
   order by (t.estado = 'aprobada') desc, t.anio desc, t.nombre;
$$;

revoke all on function public.titulaciones_visibles(uuid) from public, anon, authenticated;
grant execute on function public.titulaciones_visibles(uuid) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2) Denuncias de titulaciones. Solo las ve quien denuncia (RLS de 068) y el
--    administrador. No bloquean ni cambian nada por sí solas.
-- ----------------------------------------------------------------------------
alter table public.denuncias
  add column if not exists detalle text;

alter table public.denuncias drop constraint if exists denuncias_detalle_longitud;
alter table public.denuncias
  add constraint denuncias_detalle_longitud check (char_length(detalle) <= 400);

alter table public.denuncias drop constraint if exists denuncias_tipo_check;
alter table public.denuncias
  add constraint denuncias_tipo_check check (tipo in ('sesion', 'usuario', 'titulacion'));

alter table public.denuncias drop constraint if exists denuncias_motivo_check;
alter table public.denuncias
  add constraint denuncias_motivo_check check (motivo in (
    'contenido_inapropiado', 'estafa', 'suplantacion', 'acoso', 'peligro', 'otro',
    'titulacion_falsa', 'datos_incorrectos'));

-- El servidor fija a quién se denuncia y guarda qué decía la titulación, por si
-- su autor la borra antes de la revisión.
create or replace function public.preparar_denuncia_titulacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo public.titulaciones%rowtype;
begin
  if new.tipo <> 'titulacion' then
    new.detalle := null;
    return new;
  end if;

  select * into v_titulo from public.titulaciones
   where id = new.objetivo_id and estado in ('pendiente', 'aprobada');
  if not found or public.me_ha_bloqueado(v_titulo.usuario_id) then
    raise exception 'Esa titulación ya no está disponible.' using errcode = 'P0001';
  end if;
  if v_titulo.usuario_id = new.denunciante_id then
    raise exception 'No puedes denunciar tu propia titulación.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(new.comentario, ''))) < 10 then
    raise exception 'Explica qué ocurre con esta titulación (al menos 10 caracteres).' using errcode = 'P0001';
  end if;

  new.usuario_denunciado_id := v_titulo.usuario_id;
  new.detalle := left(v_titulo.nombre || ' — ' || v_titulo.entidad || ' (' || v_titulo.anio || ')', 400);
  new.estado := 'pendiente';
  return new;
end;
$$;

revoke all on function public.preparar_denuncia_titulacion() from public, anon, authenticated;

drop trigger if exists trg_preparar_denuncia_titulacion on public.denuncias;
create trigger trg_preparar_denuncia_titulacion
  before insert on public.denuncias
  for each row execute function public.preparar_denuncia_titulacion();
