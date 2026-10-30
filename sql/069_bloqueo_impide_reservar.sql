-- ============================================================================
-- Ruleafit · 069_bloqueo_impide_reservar.sql
-- Si un entrenador (organizador) ha bloqueado a un usuario (sql/068), ese
-- usuario ya no puede reservar sus sesiones.
--
-- EJECUTADO a mano en el SQL Editor de Supabase (proyecto "ruleafit") el 30 de
-- octubre de 2026 y probado: con un bloqueo, la reserva se rechaza con el mensaje
-- genérico; sin bloqueo, se permite.
--
-- Se hace con un trigger BEFORE INSERT en public.reservas, y NO modificando
-- reservar_clase(): así no se toca la función central de reservas (que ya se ha
-- reescrito varias veces: sql/001, 060, 063) y la comprobación vale para
-- cualquier camino que cree una reserva. Como reservar_clase() inserta la
-- reserva antes de sumar la plaza, si el trigger falla se deshace todo.
--
-- El mensaje es genérico a propósito ("no está disponible para ti"): no revela
-- que existe un bloqueo.
-- No cancela las reservas que ya existan entre ambos usuarios.
-- ============================================================================

create or replace function public.impedir_reserva_si_bloqueado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.clases c
      join public.bloqueos b on b.bloqueador_id = c.trainer_id
     where c.id = new.clase_id
       and b.bloqueado_id = new.cliente_id
  ) then
    raise exception 'Esta sesión no está disponible para ti.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_impedir_reserva_si_bloqueado on public.reservas;

create trigger trg_impedir_reserva_si_bloqueado
  before insert on public.reservas
  for each row
  execute function public.impedir_reserva_si_bloqueado();
