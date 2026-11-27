-- ============================================================================
-- Ruleafit · 104_permisos_explicitos.sql
-- Incluye además (B1): una sesión cancelada queda con 0 plazas ocupadas, sea cual sea la vía de cancelación.
-- Supabase ha dejado de conceder permisos por defecto sobre las tablas nuevas. Las creadas en 095-100 las lee y
-- escribe la web con la clave de servicio: se le conceden expresamente. Los permisos de usuarios no cambian
-- (cada migración ya los fija). Repetible. Requiere 095, 096, 098, 099 y 100.
-- Reversión: sql/104_permisos_explicitos_reversion.sql
-- ============================================================================
grant select, insert, update, delete on
  public.archivo_fiscal,
  public.devoluciones,
  public.incidencias_pago,
  public.incidencias_pago_eventos,
  public.alertas_operativas,
  public.reprogramaciones,
  public.reprogramacion_respuestas
to service_role;

-- B1: sesión cancelada = 0 plazas ocupadas (cancelar_clase no las reiniciaba). Un trigger cubre todas las vías.
create or replace function public.vaciar_plazas_sesion_cancelada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.plazas_ocupadas := 0;
  return new;
end;
$$;
revoke all on function public.vaciar_plazas_sesion_cancelada() from public, anon, authenticated;
drop trigger if exists trg_vaciar_plazas_sesion_cancelada on public.clases;
create trigger trg_vaciar_plazas_sesion_cancelada
  before update on public.clases
  for each row
  when (new.estado = 'cancelada')
  execute function public.vaciar_plazas_sesion_cancelada();

-- Las que ya estaban canceladas.
update public.clases set plazas_ocupadas = 0 where estado = 'cancelada' and plazas_ocupadas <> 0;
