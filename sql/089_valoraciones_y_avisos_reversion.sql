-- ============================================================================
-- Ruleafit · 089_valoraciones_y_avisos_reversion.sql
-- Deshace C16 y C18: quita el cron, las funciones y las tablas nuevas (se pierde el historial de
-- avisos del organizador y el registro de solicitudes de valoración) y restaura generar_notificacion()
-- a su versión anterior (sin las dos categorías nuevas). Las notificaciones ya entregadas en la campana
-- permanecen (con su tipo 'solicitud_valoracion' / 'aviso_organizador', que pasaría a tratarse como
-- tipo desconocido = crítico si se vuelven a generar).
-- ============================================================================
do $$ begin perform cron.unschedule('solicitar-valoraciones'); exception when others then null; end $$;

drop function if exists public.solicitar_valoraciones(timestamptz);
drop function if exists public.enviar_aviso_participantes(uuid, text);
drop function if exists public.reintentar_aviso(uuid);
drop function if exists public.avisos_sesion_organizador(uuid);
drop function if exists public.avisos_sesion_participante(uuid);
drop function if exists public.avisos_notificar_pendientes(uuid);
drop function if exists public.avisos_destinatarios_actuales(uuid);
drop trigger if exists trg_proteger_aviso_enviado on public.avisos_organizador;
drop function if exists public.proteger_aviso_enviado();
drop table if exists public.avisos_organizador_destinatarios;
drop table if exists public.avisos_organizador;
drop table if exists public.solicitudes_valoracion;
drop table if exists public.solicitudes_valoracion_config;

create or replace function public.generar_notificacion(
  p_usuario_id uuid,
  p_tipo       text,
  p_titulo     text,
  p_cuerpo     text,
  p_url        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categoria text;
  v_critica   boolean := false;
  v_activa    boolean;
begin
  case p_tipo
    when 'sesion_publicada' then
      v_categoria := 'publicaciones';
    when 'recordatorio_sesion_24h' then
      v_categoria := 'recordatorio_24h';
    when 'recordatorio_sesion_7h' then
      v_categoria := 'recordatorio_7h';
    when 'recordatorio_sesion_2h' then
      v_categoria := 'recordatorio_2h';
    when 'recordatorio_sesion_24h_entrenador' then
      v_categoria := 'recordatorio_24h_entrenador';
    when 'recordatorio_sesion_7h_entrenador' then
      v_categoria := 'recordatorio_7h_entrenador';
    when 'recordatorio_sesion_2h_entrenador' then
      v_categoria := 'recordatorio_2h_entrenador';
    when 'recordatorio_sesion_10min_entrenador' then
      v_categoria := 'recordatorio_10min_entrenador';
    when 'plazas_agotadas' then
      v_categoria := 'plazas_agotadas';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      v_categoria := 'otras';
      v_critica := true;
  end case;

  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;
