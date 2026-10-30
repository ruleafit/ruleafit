-- ============================================================================
-- Ruleafit · 068_cumplimiento_tiendas.sql
-- Requisitos de las tiendas de aplicaciones (Apple y Google) que también
-- mejoran la web:
--   1) public.denuncias   : denunciar una sesión o a un usuario.
--   2) public.bloqueos    : bloquear usuarios (dejas de ver sus sesiones).
--   3) eliminar_mi_cuenta(): borrar la propia cuenta y todos sus datos.
--
-- EJECUTADO a mano en el SQL Editor de Supabase (proyecto "ruleafit") el 30 de
-- octubre de 2026. Lo usa el código de app/cuenta, components/BotonDenunciar.js,
-- components/BotonBloquear.js y components/EliminarCuenta.js.
--
-- Cambio aditivo salvo la función de borrado, que se ejecuta solo cuando el
-- propio usuario la llama sobre su cuenta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Denuncias
--    Quien denuncia solo puede crear y ver las suyas. La revisión la hace el
--    administrador desde el panel de Supabase (la clave de servicio se salta
--    RLS). Si el denunciante borra su cuenta, la denuncia se conserva sin su
--    identificador (set null) para no perder el registro de moderación.
-- ----------------------------------------------------------------------------
create table if not exists public.denuncias (
  id                    uuid primary key default gen_random_uuid(),
  denunciante_id        uuid references auth.users(id) on delete set null,
  tipo                  text not null check (tipo in ('sesion', 'usuario')),
  objetivo_id           uuid not null,
  usuario_denunciado_id uuid,
  motivo                text not null check (motivo in (
                          'contenido_inapropiado', 'estafa', 'suplantacion',
                          'acoso', 'peligro', 'otro')),
  comentario            text check (comentario is null or char_length(comentario) <= 1000),
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente', 'revisada', 'descartada')),
  created_at            timestamptz not null default now(),
  unique (denunciante_id, tipo, objetivo_id)
);

alter table public.denuncias enable row level security;

drop policy if exists "crear denuncia propia" on public.denuncias;
create policy "crear denuncia propia"
  on public.denuncias
  for insert
  to authenticated
  with check (
    auth.uid() = denunciante_id
    and (usuario_denunciado_id is null or usuario_denunciado_id <> auth.uid())
  );

drop policy if exists "ver mis denuncias" on public.denuncias;
create policy "ver mis denuncias"
  on public.denuncias
  for select
  to authenticated
  using (auth.uid() = denunciante_id);

comment on table public.denuncias is
  'Denuncias de sesiones o usuarios hechas por usuarios autenticados. Se revisan desde el panel de Supabase (clave de servicio). Sin politicas de update ni delete para usuarios.';


-- ----------------------------------------------------------------------------
-- 2) Bloqueos
--    Cada usuario gestiona solo los suyos. Efecto actual (frontend): el
--    bloqueador deja de ver en /clases y /entrenadores las sesiones y el perfil
--    del bloqueado.
-- ----------------------------------------------------------------------------
create table if not exists public.bloqueos (
  bloqueador_id uuid not null references auth.users(id) on delete cascade,
  bloqueado_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id),
  check (bloqueador_id <> bloqueado_id)
);

alter table public.bloqueos enable row level security;

drop policy if exists "ver mis bloqueos" on public.bloqueos;
create policy "ver mis bloqueos"
  on public.bloqueos for select to authenticated
  using (auth.uid() = bloqueador_id);

drop policy if exists "crear mis bloqueos" on public.bloqueos;
create policy "crear mis bloqueos"
  on public.bloqueos for insert to authenticated
  with check (auth.uid() = bloqueador_id);

drop policy if exists "borrar mis bloqueos" on public.bloqueos;
create policy "borrar mis bloqueos"
  on public.bloqueos for delete to authenticated
  using (auth.uid() = bloqueador_id);


-- ----------------------------------------------------------------------------
-- 3) eliminar_mi_cuenta()
--    Borra la cuenta del usuario que la llama (auth.uid()), y con ella, en
--    cascada: perfil, reservas, sesiones publicadas (y las reservas de otros
--    sobre ellas), valoraciones, seguimientos, Rulos, notificaciones, bonos...
--
--    Antes de borrar:
--    a) Se rechaza si el usuario tiene sesiones PRÓXIMAS con reservas activas
--       de otras personas: debe cancelarlas primero (así nadie pierde una
--       reserva sin aviso).
--    b) Se liberan las plazas de sus reservas activas (el borrado en cascada
--       no actualiza solo el contador plazas_ocupadas).
--    c) Se pone a null las dos referencias que no tienen ON DELETE CASCADE:
--       rulos_movimientos.otorgado_por y reservas.asistencia_marcada_por; sin
--       esto el borrado fallaría para quien marcó asistencia o concedió Rulos.
--
--    Pendiente cuando existan los pagos: si hay liquidaciones pendientes o
--    datos fiscales que la ley obliga a conservar, esta función debe rechazar
--    el borrado o conservar esos datos (revisar con el gestor).
-- ----------------------------------------------------------------------------
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_ahora   timestamp := (now() at time zone 'Europe/Madrid');
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  if exists (
    select 1
      from public.clases c
      join public.reservas r on r.clase_id = c.id
      where c.trainer_id = v_usuario
        and c.estado = 'activa'
        and r.estado = 'activa'
        and (c.fecha::text || ' ' || c.hora::text)::timestamp > v_ahora
  ) then
    raise exception 'Tienes sesiones próximas con reservas. Cancélalas antes de eliminar tu cuenta.'
      using errcode = 'P0001';
  end if;

  update public.clases c
     set plazas_ocupadas = greatest(c.plazas_ocupadas - 1, 0)
    from public.reservas r
   where r.clase_id = c.id
     and r.cliente_id = v_usuario
     and r.estado = 'activa'
     and c.estado = 'activa';

  update public.rulos_movimientos set otorgado_por = null where otorgado_por = v_usuario;
  update public.reservas set asistencia_marcada_por = null where asistencia_marcada_por = v_usuario;

  delete from auth.users where id = v_usuario;
end;
$$;

comment on function public.eliminar_mi_cuenta() is
  'Borra la cuenta del usuario autenticado y sus datos (cascada). Rechaza si tiene sesiones proximas con reservas activas de otras personas. SECURITY DEFINER: solo opera sobre auth.uid().';

revoke all on function public.eliminar_mi_cuenta() from public;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
