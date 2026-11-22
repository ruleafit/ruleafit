-- ============================================================================
-- Ruleafit · 085_participantes_sesion.sql
-- Mostrar en el detalle de una sesión quién ha reservado, con privacidad por usuario.
--
-- NO EJECUTADO todavía. Aplicar solo con autorización expresa.
--
-- 1) public.perfil_privacidad: preferencia «Mostrar mi @ a otros participantes»
--    (OPT-IN: por defecto DESACTIVADA; sin fila = desactivada, es decir, «Usuario
--    anónimo» ante los demás participantes hasta que el usuario la active él mismo). Es una tabla aparte, NO una columna
--    de public.perfiles, porque perfiles se puede leer públicamente y la preferencia
--    de cada usuario no debe ser pública. Cada usuario solo ve y escribe la suya (RLS).
--
-- 2) public.participantes_clase(p_clase_id): ÚNICA vía para saber quién participa.
--    Reglas, aplicadas EN EL SERVIDOR (la web nunca recibe la identidad de un anónimo):
--      · Solo usuarios con sesión iniciada (anon no recibe nada).
--      · Solo reservas 'activa' de sesiones 'activa'.
--      · El organizador de la sesión ve SIEMPRE el @ real de todos, aunque se hayan
--        ocultado (el campo «oculto» solo le indica que el usuario eligió ocultarse).
--      · Cada usuario ve su propia reserva con su @ (es_yo = true).
--      · Los demás ven el @ de quien lo permite y, de quien no, una fila con
--        username = NULL y anonimo = true (sin id, foto, nombre ni nada que identifique).
--        Las filas anónimas van al final y sin ningún orden que revele a nadie.
--      · No se muestran participantes con un bloqueo en cualquier sentido con quien mira
--        (salvo que mire el organizador o sea su propia reserva).
--    La preferencia se lee en el momento de la consulta: se aplica a todas las
--    reservas, presentes y futuras, en cuanto el usuario la cambia.
--
-- NO toca reservas, pagos, plazas, notificaciones ni sus funciones. Solo LEE reservas.
-- Reversión: sql/085_participantes_sesion_reversion.sql
-- Comprobación: sql/085_participantes_sesion_verificacion.sql
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Preferencia de privacidad
-- ----------------------------------------------------------------------------
create table if not exists public.perfil_privacidad (
  usuario_id                   uuid primary key references auth.users(id) on delete cascade,
  mostrar_arroba_participantes boolean not null default false
);

alter table public.perfil_privacidad enable row level security;

revoke all on public.perfil_privacidad from public, anon, authenticated;
grant select on public.perfil_privacidad to authenticated;
grant insert (usuario_id, mostrar_arroba_participantes) on public.perfil_privacidad to authenticated;
grant update (mostrar_arroba_participantes) on public.perfil_privacidad to authenticated;

drop policy if exists "perfil_privacidad: lee la suya" on public.perfil_privacidad;
create policy "perfil_privacidad: lee la suya"
  on public.perfil_privacidad for select to authenticated
  using ( (select auth.uid()) = usuario_id );

drop policy if exists "perfil_privacidad: crea la suya" on public.perfil_privacidad;
create policy "perfil_privacidad: crea la suya"
  on public.perfil_privacidad for insert to authenticated
  with check ( (select auth.uid()) = usuario_id );

drop policy if exists "perfil_privacidad: edita la suya" on public.perfil_privacidad;
create policy "perfil_privacidad: edita la suya"
  on public.perfil_privacidad for update to authenticated
  using ( (select auth.uid()) = usuario_id )
  with check ( (select auth.uid()) = usuario_id );

comment on table public.perfil_privacidad is
  'Preferencias de privacidad por usuario. Sin fila = valores por defecto (mostrar @ a otros participantes: NO; el usuario debe activarlo voluntariamente).';


-- ----------------------------------------------------------------------------
-- 2) participantes_clase
-- ----------------------------------------------------------------------------
create or replace function public.participantes_clase(p_clase_id uuid)
returns table (username text, anonimo boolean, es_yo boolean, oculto boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_trainer uuid;
  v_estado  text;
begin
  if v_uid is null then
    return;
  end if;

  select c.trainer_id, c.estado into v_trainer, v_estado
    from public.clases c where c.id = p_clase_id;
  if not found or v_estado <> 'activa' then
    return;
  end if;

  return query
  with r as (
    select re.cliente_id,
           re.created_at,
           p.username as nombre,
           coalesce(pp.mostrar_arroba_participantes, false) as permite,
           (v_uid = v_trainer or re.cliente_id = v_uid) as ve_real
      from public.reservas re
      join public.perfiles p on p.id = re.cliente_id
      left join public.perfil_privacidad pp on pp.usuario_id = re.cliente_id
     where re.clase_id = p_clase_id
       and re.estado = 'activa'
       and (
            v_uid = v_trainer
            or re.cliente_id = v_uid
            or not exists (
                 select 1 from public.bloqueos b
                  where (b.bloqueador_id = v_uid and b.bloqueado_id = re.cliente_id)
                     or (b.bloqueador_id = re.cliente_id and b.bloqueado_id = v_uid))
           )
  )
  select case when r.ve_real or r.permite then r.nombre end,
         not (r.ve_real or r.permite),
         r.cliente_id = v_uid,
         not r.permite
    from r
   order by
     case when v_uid = v_trainer then 0 when r.ve_real or r.permite then 0 else 1 end,
     case when v_uid = v_trainer then to_char(r.created_at, 'YYYYMMDDHH24MISSUS')
          when r.ve_real or r.permite then lower(r.nombre)
          else md5(random()::text) end;   -- anónimos: orden aleatorio (no revela el orden de reserva)
end;
$$;

comment on function public.participantes_clase(uuid) is
  'Participantes con reserva activa de una sesión activa. Solo usuarios con sesión. El organizador y el propio usuario ven el @ real; el resto ve el @ de quien lo permite y filas anónimas sin identidad para quien no.';

revoke all on function public.participantes_clase(uuid) from public, anon, authenticated;
grant execute on function public.participantes_clase(uuid) to authenticated;

commit;
