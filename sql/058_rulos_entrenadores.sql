-- ============================================================================
-- Ruleafit · 058_rulos_entrenadores.sql
-- Tarea B: nuevos Rulos para entrenadores.
--   1) 20 Rulos, concesión única, al completar la foto de perfil.
--   2) 20 Rulos, concesión única, al completar la descripción del perfil.
--   3) 5 Rulos por cada clase que llega a REALIZARSE (no por publicarla),
--      solo si tuvo al menos 1 alumno reservado — decisión de producto
--      (29 agosto 2026): sin esta guarda, un entrenador podría publicar
--      clases vacías en bucle y cobrar Rulos sin que nadie fuera nunca.
--
-- NO EJECUTADO todavía. Preparado para revisión antes de aplicarlo en
-- Supabase (proyecto "ruleafit").
--
-- Depende de sql/057_asistencia_automatica.sql (mismo criterio de "clase
-- completada" en Europe/Madrid, mismo patrón de función de mantenimiento por
-- cron) y de sql/020_perfiles_descripcion_foto.sql (columnas
-- perfiles.descripcion / perfiles.foto_url).
--
-- IMPORTANTE sobre nombres: igual que sql/057, este archivo usa los nombres
-- reales ya renombrados en la base de datos: rulos_saldos / rulos_movimientos
-- / rulos_motivos / otorgar_rulos(). PENDIENTE DE CONFIRMAR antes de
-- ejecutar: verificar en el SQL Editor que estas tablas/función existen
-- realmente (select * from rulos_motivos limit 1; \df otorgar_rulos), porque
-- el documento claude/rename-open-a-rulos.md todavía marca ese rename como
-- "no ejecutado" y sql/057 asume lo contrario. Si esas tablas NO existen
-- todavía con esos nombres, hay que aplicar antes esa migración (o ajustar
-- este archivo a los nombres open_* que sí existen hoy).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Nuevos motivos en el catálogo (idempotente).
-- ----------------------------------------------------------------------------
insert into public.rulos_motivos (codigo, descripcion) values
  ('foto_perfil', 'Foto de perfil añadida por primera vez (entrenador)'),
  ('descripcion_perfil', 'Descripción de perfil completada por primera vez (entrenador)'),
  ('clase_realizada', 'Clase publicada por el entrenador que llegó a realizarse con al menos un alumno')
on conflict (codigo) do nothing;


-- ----------------------------------------------------------------------------
-- 2) Trigger de bonos de perfil (foto / descripción), solo entrenadores.
--
--    Por qué comprobar el rol aquí y no confiar en el frontend: la política
--    RLS de UPDATE de perfiles (sql/004, "cada usuario actualiza su propio
--    perfil") es simplemente "id = auth.uid()", sin distinguir rol. app/
--    cuenta/page.js solo pinta los campos de foto/descripción para
--    entrenadores, pero un cliente podría llamar directamente a la API de
--    Supabase (supabase.from('perfiles').update({foto_url, descripcion}))
--    y cobrar los 40 Rulos igualmente si esta función no filtrara por rol.
--
--    Guarda doble contra doble concesión: el trigger solo se dispara si
--    foto_url o descripcion cambiaron (cláusula WHEN) y, dentro de la
--    función, cada bono solo se concede en la transición de "vacío" a "con
--    contenido" Y si todavía no existe un movimiento con esa referencia y
--    motivo (mismo patrón de referencia_tipo/referencia_id que sql/057) —
--    así, aunque en el futuro se permitiera borrar y volver a subir la foto,
--    no se cobraría dos veces.
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos_perfil_entrenador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol                text;
  v_cantidad_rulos     constant integer := 20;
  v_tenia_foto         boolean;
  v_tiene_foto         boolean;
  v_tenia_descripcion  boolean;
  v_tiene_descripcion  boolean;
begin
  -- 1. Solo entrenadores. El rol vive en auth.users.raw_user_meta_data, no
  --    en perfiles, mismo patrón de lookup que reservas_de_mis_clases().
  select raw_user_meta_data ->> 'rol'
    into v_rol
    from auth.users
    where id = new.id;

  if v_rol is distinct from 'entrenador' then
    return new;
  end if;

  -- 2. Bono por foto de perfil: transición de sin foto a con foto.
  v_tenia_foto := coalesce(old.foto_url, '') <> '';
  v_tiene_foto := coalesce(new.foto_url, '') <> '';

  if v_tiene_foto and not v_tenia_foto and not exists (
    select 1 from public.rulos_movimientos
      where referencia_tipo = 'perfil'
        and referencia_id = new.id
        and motivo = 'foto_perfil'
  ) then
    perform public.otorgar_rulos(
      p_usuario_id      => new.id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'foto_perfil',
      p_referencia_tipo => 'perfil',
      p_referencia_id   => new.id,
      p_otorgado_por    => null,
      p_nota            => null
    );
  end if;

  -- 3. Bono por descripción de perfil: transición de vacía/nula a con texto
  --    (trim para no premiar una descripción de solo espacios).
  v_tenia_descripcion := coalesce(trim(old.descripcion), '') <> '';
  v_tiene_descripcion := coalesce(trim(new.descripcion), '') <> '';

  if v_tiene_descripcion and not v_tenia_descripcion and not exists (
    select 1 from public.rulos_movimientos
      where referencia_tipo = 'perfil'
        and referencia_id = new.id
        and motivo = 'descripcion_perfil'
  ) then
    perform public.otorgar_rulos(
      p_usuario_id      => new.id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'descripcion_perfil',
      p_referencia_tipo => 'perfil',
      p_referencia_id   => new.id,
      p_otorgado_por    => null,
      p_nota            => null
    );
  end if;

  return new;
end;
$$;

comment on function public.otorgar_rulos_perfil_entrenador() is
  'Trigger AFTER UPDATE en perfiles: concede 20 Rulos, una sola vez, al entrenador que completa por primera vez su foto de perfil, y otros 20 al completar por primera vez su descripción. No se aplica a clientes (comprobación de rol vía auth.users), aunque la RLS de perfiles les permitiera técnicamente escribir esas columnas. Guarda doble contra doble concesión: solo actúa en la transición vacío->con contenido y además comprueba que no exista ya un movimiento con esa referencia. Función declarada RETURNS TRIGGER: Postgres impide invocarla fuera de un trigger, así que no hace falta revocar EXECUTE aparte.';

drop trigger if exists on_perfil_actualizado_otorgar_rulos on public.perfiles;

create trigger on_perfil_actualizado_otorgar_rulos
  after update on public.perfiles
  for each row
  when (
    coalesce(new.foto_url, '') is distinct from coalesce(old.foto_url, '')
    or coalesce(trim(new.descripcion), '') is distinct from coalesce(trim(old.descripcion), '')
  )
  execute function public.otorgar_rulos_perfil_entrenador();


-- ----------------------------------------------------------------------------
-- 3) 5 Rulos al entrenador por cada clase que se realiza (no por publicarla).
--
--    Mismo patrón de función de mantenimiento por cron que
--    completar_asistencia_clases_pasadas() (sql/057) y
--    autocancelar_clases_sin_minimo() (sql/033): sin auth.uid() que
--    comprobar, la invoca el sistema. Misma ventana de 72h hacia atrás y
--    mismo criterio de fecha+hora exacta en Europe/Madrid.
--
--    Requiere plazas_ocupadas > 0 (decisión de producto, 29 agosto 2026):
--    una clase publicada sin ninguna reserva no genera Rulos, para que no
--    se pueda cobrar publicando clases vacías en bucle. Con esto, una clase
--    solo puede llegar aquí si además no fue autocancelada por mínimo (sql/
--    033 la habría marcado 'cancelada' antes de que empezara).
-- ----------------------------------------------------------------------------
create or replace function public.otorgar_rulos_clase_completada()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora_local      timestamp;
  v_clase            record;
  v_rulos_concedidos integer := 0;
  v_cantidad_rulos   constant integer := 5;
begin
  v_ahora_local := (now() at time zone 'Europe/Madrid');

  for v_clase in
    select c.id, c.trainer_id
      from public.clases c
      where c.estado <> 'cancelada'
        and c.plazas_ocupadas > 0
        and (c.fecha::text || ' ' || c.hora::text)::timestamp <= v_ahora_local
        and (c.fecha::text || ' ' || c.hora::text)::timestamp >= v_ahora_local - interval '72 hours'
        and not exists (
          select 1
            from public.rulos_movimientos m
            where m.referencia_tipo = 'clase'
              and m.referencia_id = c.id
              and m.motivo = 'clase_realizada'
        )
  loop
    perform public.otorgar_rulos(
      p_usuario_id      => v_clase.trainer_id,
      p_cantidad        => v_cantidad_rulos,
      p_motivo          => 'clase_realizada',
      p_referencia_tipo => 'clase',
      p_referencia_id   => v_clase.id,
      p_otorgado_por    => null,
      p_nota            => null
    );

    v_rulos_concedidos := v_rulos_concedidos + 1;
  end loop;

  return v_rulos_concedidos;
end;
$$;

comment on function public.otorgar_rulos_clase_completada() is
  'Pensada para ser ejecutada por un cron cada 15 minutos: concede automáticamente 5 Rulos (motivo clase_realizada) al entrenador dueño de cada clase no cancelada que ya haya empezado (mismo criterio Europe/Madrid que completar_asistencia_clases_pasadas), con al menos 1 plaza ocupada, acotado a clases de las últimas 72h. Evita doble concesión comprobando que no exista ya un movimiento en rulos_movimientos con referencia_tipo=''clase'' y referencia_id = la clase. No valida propiedad ni auth.uid(): la invoca el sistema. Devuelve el número de clases que generaron Rulos en la ejecución.';

revoke all on function public.otorgar_rulos_clase_completada() from public;


-- ----------------------------------------------------------------------------
-- 4) Cron: ejecuta otorgar_rulos_clase_completada() cada 15 minutos, mismo
--    intervalo que el cron de sql/057 (completar-asistencia-clases-pasadas).
--    cron.schedule con el mismo nombre re-ejecuta de forma idempotente.
-- ----------------------------------------------------------------------------
select cron.schedule(
  'otorgar-rulos-clases-completadas',
  '*/15 * * * *',
  $$ select otorgar_rulos_clase_completada(); $$
);
