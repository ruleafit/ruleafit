-- Reversión de 111. ATENCIÓN: borra las denuncias de titulaciones recibidas.
-- Ejecutarla antes que la reversión de 110 y tras retirar de la web esta versión.

drop trigger if exists trg_preparar_denuncia_titulacion on public.denuncias;
drop function if exists public.preparar_denuncia_titulacion();
drop function if exists public.titulaciones_visibles(uuid);

delete from public.denuncias where tipo = 'titulacion';

alter table public.denuncias drop constraint if exists denuncias_tipo_check;
alter table public.denuncias
  add constraint denuncias_tipo_check check (tipo in ('sesion', 'usuario'));

alter table public.denuncias drop constraint if exists denuncias_motivo_check;
alter table public.denuncias
  add constraint denuncias_motivo_check check (motivo in (
    'contenido_inapropiado', 'estafa', 'suplantacion', 'acoso', 'peligro', 'otro'));

alter table public.denuncias drop constraint if exists denuncias_detalle_longitud;
alter table public.denuncias drop column if exists detalle;
