-- Ruleafit · 086_bloqueos_invisibles_reversion.sql · NO EJECUTADO.
-- Deshace sql/086: restaura las políticas y funciones tal como estaban antes (los bloqueos
-- vuelven a ser solo «B no puede reservar»; los datos no se tocan).
begin;

drop policy if exists "Ver clases activas" on public.clases;
create policy "Ver clases activas" on public.clases for select to public
  using ( (estado = 'activa'::text) or usuario_tiene_reserva_en_clase(id) );

drop policy if exists "perfiles visibles publicamente" on public.perfiles;
create policy "perfiles visibles publicamente" on public.perfiles for select to public using (true);

drop policy if exists "seguimientos visibles publicamente" on public.seguimientos;
create policy "seguimientos visibles publicamente" on public.seguimientos for select to public using (true);

drop policy if exists "favoritos: lee los suyos" on public.favoritos;
create policy "favoritos: lee los suyos" on public.favoritos for select to authenticated
  using ( (select auth.uid()) = usuario_id );

drop policy if exists "valoraciones visibles publicamente" on public.valoraciones;
create policy "valoraciones visibles publicamente" on public.valoraciones for select to public using (true);

drop policy if exists "bonos activos visibles a todos, propios siempre visibles" on public.bonos;
create policy "bonos activos visibles a todos, propios siempre visibles" on public.bonos for select to authenticated
  using ( (activo = true) or (trainer_id = auth.uid()) );

drop policy if exists "cualquier autenticado ve el saldo de cualquiera" on public.rulos_saldos;
create policy "cualquier autenticado ve el saldo de cualquiera" on public.rulos_saldos for select to authenticated using (true);

create or replace function public.listar_entrenadores()
returns table (id uuid, username text, descripcion text, foto_url text, rulos_saldo integer)
language sql
security definer
set search_path = public
as $$
    select p.id, p.username, p.descripcion, p.foto_url, coalesce(rs.saldo, 0) as rulos_saldo
    from public.perfiles p
    left join public.rulos_saldos rs on rs.usuario_id = p.id
    order by p.username asc;
$$;

create or replace function public.notificar_publicacion_clase()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
  -- favoritos NO reciben nada.
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
$function$;

-- (Las reservas ya canceladas por bloqueos NO se restauran: la reversión no deshace cancelaciones ni reembolsos.)
drop trigger if exists trg_cancelar_reservas_por_bloqueo on public.bloqueos;
drop function if exists public.mis_reservas_canceladas_por_bloqueo();
drop function if exists public.cancelar_reservas_por_bloqueo();
-- La tabla de registro se conserva por si hay cancelaciones ya hechas (se puede borrar a mano).
drop trigger if exists trg_impedir_bono_si_bloqueado on public.bonos_clientes;
drop function if exists public.impedir_bono_si_bloqueado();
drop function if exists public.tengo_reserva_activa_en_clase(uuid);
drop function if exists public.tengo_reserva_con(uuid);
drop function if exists public.me_ha_bloqueado(uuid);
drop index if exists public.bloqueos_bloqueado_bloqueador_idx;

commit;
