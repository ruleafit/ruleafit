-- ============================================================================
-- Ruleafit · 086_bloqueos_invisibles.sql
-- Si A bloquea a B, para B es como si A no existiera. Se aplica EN LA BASE DE DATOS.
--
-- NO EJECUTADO todavía. Aplicar solo con autorización expresa.
--
-- Qué ya existía (se reutiliza): tabla public.bloqueos (bloqueador_id, bloqueado_id),
-- el trigger trg_impedir_reserva_si_bloqueado (B no puede reservar sesiones de A; sigue
-- intacto) y los filtros de la web, que ahora son solo comodidad: la seguridad es esta.
--
-- Qué hace (B = bloqueado, A = quien bloquea):
--  1. Sesiones de A: B no las ve (clases), ni en listados, mapa, calendario, enlaces
--     directos ni API. EXCEPCIÓN: las sesiones en las que B tiene una reserva ACTIVA (las
--     que se cancelan por el bloqueo dejan de ser visibles: ver el punto 7).
--  2. Perfil de A: B no lo ve (perfiles), ni en buscadores (listar_entrenadores), ni por
--     URL antigua. EXCEPCIÓN: A sigue visible para B mientras B tenga una reserva ACTIVA con él.
--  3. A desaparece de seguidores/seguidos (seguimientos), de los favoritos de B
--     (favoritos), de las valoraciones (valoraciones), de los bonos (bonos) y del saldo
--     de Rulos (rulos_saldos) que B puede consultar.
--  4. Avisos: el aviso de «nueva sesión» de favoritos (notificar_publicacion_clase) no
--     se envía a B si A lo ha bloqueado (ni al revés). Los avisos de zona ya excluían
--     bloqueos en ambos sentidos (sql/080-082).
--  5. B tampoco puede adquirir bonos de A (trigger nuevo en bonos_clientes).
--  6. Desbloquear (borrar la fila de bloqueos) lo devuelve todo a la normalidad al
--     instante: nada se borra ni se copia. NO restaura reservas canceladas ni deshace reembolsos.
--  7. CANCELACIÓN AUTOMÁTICA AL BLOQUEAR (trigger sobre bloqueos): se cancelan TODAS las
--     reservas ACTIVAS de B en sesiones FUTURAS ACTIVAS de A (en la misma transacción que el
--     bloqueo: o se hace todo o no se bloquea), se libera la plaza de B y la sesión de A
--     sigue para los demás. No se tocan reservas de sesiones ya celebradas ni canceladas.
--     · Excepción a la política de 2 h: se cancela siempre, a cualquier hora.
--     · B recibe una notificación neutra (no menciona el bloqueo ni a A).
--     · Sesión gratuita: solo se cancela. Reserva con bono: se cancela y la sesión del bono
--       vuelve a estar disponible (el uso del bono se cuenta con las reservas activas).
--     · Sesión de pago con cobro 'pagado': el cobro pasa a 'requiere_reembolso' (el estado ya
--       previsto en sql/071). ¡NO se marca nada como reembolsado ni se mueve dinero!: la
--       devolución al banco (Redsys) y el ajuste de la bolsa del organizador son la «fase 2»
--       de pagos, que aún NO existe en la plataforma (pagos_activos = false, 0 cobros hoy).
--       Un cobro en requiere_reembolso no se libera al organizador.
--     · Idempotente: cada reserva solo se cancela una vez y cada cobro solo pasa una vez a
--       requiere_reembolso.
--     · B ve la reserva cancelada y el estado de su reembolso en Mis reservas mediante
--       mis_reservas_canceladas_por_bloqueo(), que NO devuelve nada de A (ni @ ni id).
--
-- Límite conocido: un visitante SIN sesión iniciada sigue viendo lo público (no se puede
-- saber quién es). Las vistas previas al compartir un enlace (título de la sesión) también
-- son públicas por diseño.
--
-- NO toca: reservas existentes, pagos, reembolsos, cobros, reservar_clase, cancelaciones.
-- Reversión: sql/086_bloqueos_invisibles_reversion.sql
-- ============================================================================

begin;

-- Índice para la comprobación «¿me ha bloqueado X?»
create index if not exists bloqueos_bloqueado_bloqueador_idx
  on public.bloqueos (bloqueado_id, bloqueador_id);

-- ----------------------------------------------------------------------------
-- Funciones auxiliares (las llaman las políticas RLS con los permisos del que consulta,
-- por eso se les da EXECUTE a anon y authenticated; no devuelven datos, solo un booleano
-- sobre el propio usuario).
-- ----------------------------------------------------------------------------
create or replace function public.me_ha_bloqueado(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_otro is not null
     and auth.uid() is not null
     and exists (
           select 1 from public.bloqueos b
            where b.bloqueador_id = p_otro and b.bloqueado_id = auth.uid())
$$;

-- ¿Tengo una reserva ACTIVA en una sesión de este organizador que aún no ha empezado? (solo
-- reservas anteriores al bloqueo: las nuevas las cancela el trigger del punto 7)
create or replace function public.tengo_reserva_con(p_organizador uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (
           select 1
             from public.reservas r
             join public.clases c on c.id = r.clase_id
            where r.cliente_id = auth.uid() and r.estado = 'activa' and c.trainer_id = p_organizador
              and (c.fecha::text || ' ' || c.hora::text)::timestamp > (now() at time zone 'Europe/Madrid'))
$$;

-- ¿Tengo una reserva ACTIVA en esta sesión?
create or replace function public.tengo_reserva_activa_en_clase(p_clase uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (
           select 1 from public.reservas r
            where r.clase_id = p_clase and r.cliente_id = auth.uid() and r.estado = 'activa')
$$;

revoke all on function public.me_ha_bloqueado(uuid)        from public;
revoke all on function public.tengo_reserva_con(uuid)      from public;
revoke all on function public.tengo_reserva_activa_en_clase(uuid) from public;
grant execute on function public.me_ha_bloqueado(uuid)        to anon, authenticated, service_role;
grant execute on function public.tengo_reserva_con(uuid)      to anon, authenticated, service_role;
grant execute on function public.tengo_reserva_activa_en_clase(uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1) Sesiones
-- ----------------------------------------------------------------------------
drop policy if exists "Ver clases activas" on public.clases;
create policy "Ver clases activas"
  on public.clases for select to public
  using (
    -- Sin bloqueo de por medio: exactamente lo de siempre.
    (not public.me_ha_bloqueado(trainer_id)
       and (estado = 'activa' or public.usuario_tiene_reserva_en_clase(id)))
    -- Bloqueado: solo las sesiones en las que tiene una reserva ACTIVA.
    or public.tengo_reserva_activa_en_clase(id)
  );

-- ----------------------------------------------------------------------------
-- 2) Perfiles
-- ----------------------------------------------------------------------------
drop policy if exists "perfiles visibles publicamente" on public.perfiles;
create policy "perfiles visibles publicamente"
  on public.perfiles for select to public
  using ( not public.me_ha_bloqueado(id) or public.tengo_reserva_con(id) );

create or replace function public.listar_entrenadores()
returns table (id uuid, username text, descripcion text, foto_url text, rulos_saldo integer)
language sql
security definer
set search_path = public
as $$
    select p.id, p.username, p.descripcion, p.foto_url, coalesce(rs.saldo, 0) as rulos_saldo
    from public.perfiles p
    left join public.rulos_saldos rs on rs.usuario_id = p.id
    where not public.me_ha_bloqueado(p.id)
    order by p.username asc;
$$;

-- ----------------------------------------------------------------------------
-- 3) Seguidores, favoritos, valoraciones, bonos, saldo de Rulos
-- ----------------------------------------------------------------------------
drop policy if exists "seguimientos visibles publicamente" on public.seguimientos;
create policy "seguimientos visibles publicamente"
  on public.seguimientos for select to public
  using ( not public.me_ha_bloqueado(seguidor_id) and not public.me_ha_bloqueado(entrenador_id) );

drop policy if exists "favoritos: lee los suyos" on public.favoritos;
create policy "favoritos: lee los suyos"
  on public.favoritos for select to authenticated
  using ( (select auth.uid()) = usuario_id and not public.me_ha_bloqueado(favorito_id) );

drop policy if exists "valoraciones visibles publicamente" on public.valoraciones;
create policy "valoraciones visibles publicamente"
  on public.valoraciones for select to public
  using ( not public.me_ha_bloqueado(entrenador_id) and not public.me_ha_bloqueado(cliente_id) );

drop policy if exists "bonos activos visibles a todos, propios siempre visibles" on public.bonos;
create policy "bonos activos visibles a todos, propios siempre visibles"
  on public.bonos for select to authenticated
  using ( (activo = true and not public.me_ha_bloqueado(trainer_id)) or trainer_id = auth.uid() );

drop policy if exists "cualquier autenticado ve el saldo de cualquiera" on public.rulos_saldos;
create policy "cualquier autenticado ve el saldo de cualquiera"
  on public.rulos_saldos for select to authenticated
  using ( not public.me_ha_bloqueado(usuario_id) );

-- ----------------------------------------------------------------------------
-- 4) Avisos de «nueva sesión» de favoritos: no a quien tenga un bloqueo con el autor.
--    Es la misma función de sql/078 con UNA condición más en el bucle.
-- ----------------------------------------------------------------------------
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
$function$;

-- ----------------------------------------------------------------------------
-- 5) Bonos: B no puede adquirir bonos de A (adquirir_bono no se modifica)
-- ----------------------------------------------------------------------------
create or replace function public.impedir_bono_si_bloqueado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.bonos bo
      join public.bloqueos b on b.bloqueador_id = bo.trainer_id
     where bo.id = new.bono_id
       and b.bloqueado_id = new.cliente_id
  ) then
    raise exception 'Este bono no está disponible para ti.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.impedir_bono_si_bloqueado() from public, anon, authenticated;

drop trigger if exists trg_impedir_bono_si_bloqueado on public.bonos_clientes;
create trigger trg_impedir_bono_si_bloqueado
  before insert on public.bonos_clientes
  for each row execute function public.impedir_bono_si_bloqueado();

-- ----------------------------------------------------------------------------
-- 6) Cancelación automática de las reservas de B al ser bloqueado por A
-- ----------------------------------------------------------------------------
-- Registro interno (sin permisos para la web): qué reservas se cancelaron por este motivo.
-- Se guarda aparte, y no como columna de reservas, para que B no pueda leer en su propia
-- reserva el motivo de la cancelación.
create table if not exists public.reservas_canceladas_por_bloqueo (
  reserva_id   uuid primary key references public.reservas(id) on delete cascade,
  cliente_id   uuid not null,
  cobro_id     uuid references public.cobros(id) on delete set null,
  usaba_bono   boolean not null default false,
  cancelled_at timestamptz not null default now()
);
alter table public.reservas_canceladas_por_bloqueo enable row level security;
revoke all on public.reservas_canceladas_por_bloqueo from public, anon, authenticated;
create index if not exists reservas_canceladas_por_bloqueo_cliente_idx
  on public.reservas_canceladas_por_bloqueo (cliente_id);

create or replace function public.cancelar_reservas_por_bloqueo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  v_cobro  uuid;
  v_texto  text;
begin
  for r in
    select re.id as reserva_id, re.clase_id, re.bono_cliente_id, c.titulo
      from public.reservas re
      join public.clases c on c.id = re.clase_id
     where c.trainer_id = new.bloqueador_id
       and re.cliente_id = new.bloqueado_id
       and re.estado = 'activa'
       and c.estado = 'activa'
       and (c.fecha::text || ' ' || c.hora::text)::timestamp > (now() at time zone 'Europe/Madrid')
     order by c.fecha, c.hora
       for update of re, c
  loop
    -- La reserva (sin marcar «cancelada por el entrenador»: la sesión sigue en pie).
    update public.reservas
       set estado = 'cancelada', cancelled_at = now()
     where id = r.reserva_id;

    -- Libera la plaza de B; la sesión sigue activa para los demás.
    update public.clases
       set plazas_ocupadas = greatest(plazas_ocupadas - 1, 0)
     where id = r.clase_id;

    -- Cobro pagado de esta reserva: pasa a «requiere_reembolso» (solo una vez). Nunca a
    -- «reembolsado»: eso solo debe ocurrir cuando el banco haya devuelto el dinero.
    v_cobro := null;
    update public.cobros
       set estado = 'requiere_reembolso'
     where reserva_id = r.reserva_id and estado = 'pagado'
    returning id into v_cobro;

    insert into public.reservas_canceladas_por_bloqueo (reserva_id, cliente_id, cobro_id, usaba_bono)
    values (r.reserva_id, new.bloqueado_id, v_cobro, r.bono_cliente_id is not null)
    on conflict (reserva_id) do nothing;

    v_texto := 'Tu reserva para «' || left(btrim(regexp_replace(coalesce(r.titulo, 'la sesión'), '[[:space:]]+', ' ', 'g')), 80)
               || '» ha sido cancelada.'
               || case when v_cobro is not null then ' Recibirás el reembolso íntegro del importe pagado.'
                       when r.bono_cliente_id is not null then ' La sesión de tu bono vuelve a estar disponible.'
                       else '' end;

    -- Mismo sistema de notificaciones (campana + push). Tipo ya existente y crítico.
    perform public.generar_notificacion(new.bloqueado_id, 'sesion_cancelada', 'Reserva cancelada', v_texto, '/mis-reservas');
  end loop;

  return null;
end;
$$;

revoke all on function public.cancelar_reservas_por_bloqueo() from public, anon, authenticated;

drop trigger if exists trg_cancelar_reservas_por_bloqueo on public.bloqueos;
create trigger trg_cancelar_reservas_por_bloqueo
  after insert on public.bloqueos
  for each row execute function public.cancelar_reservas_por_bloqueo();

-- Lo que ve B en «Mis reservas»: sus reservas canceladas por este motivo y el estado de su
-- reembolso. Sin ningún dato del organizador (ni @, ni id, ni enlaces).
-- reembolso: NULL = no había dinero que devolver (gratuita o bono) · 'pendiente' = cancelada
-- y a la espera de que se tramite la devolución · 'reembolsado' = devuelto por el banco.
create or replace function public.mis_reservas_canceladas_por_bloqueo()
returns table (
  reserva_id   uuid,
  titulo       text,
  categoria    text,
  ciudad       text,
  fecha        date,
  hora         time,
  cancelled_at timestamptz,
  reembolso    text,
  usaba_bono   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.reserva_id,
         c.titulo, c.categoria, c.ciudad, c.fecha, c.hora,
         x.cancelled_at,
         case when x.cobro_id is null then null
              when cb.estado = 'reembolsado' then 'reembolsado'
              else 'pendiente' end,
         x.usaba_bono
    from public.reservas_canceladas_por_bloqueo x
    join public.reservas re on re.id = x.reserva_id
    join public.clases c on c.id = re.clase_id
    left join public.cobros cb on cb.id = x.cobro_id
   where x.cliente_id = auth.uid()
     and auth.uid() is not null
     and x.cancelled_at > now() - interval '60 days'
   order by x.cancelled_at desc
$$;

revoke all on function public.mis_reservas_canceladas_por_bloqueo() from public, anon;
grant execute on function public.mis_reservas_canceladas_por_bloqueo() to authenticated;

commit;
