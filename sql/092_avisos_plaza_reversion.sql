-- ============================================================================
-- Ruleafit · 092_avisos_plaza_reversion.sql
-- Deshace C15: elimina triggers, funciones y tablas de avisos de plaza y restaura generar_notificacion SIN el tipo
-- 'plaza_libre' (volvería a tratarlo como «otras», es decir, crítico). Se pierden las alertas guardadas.
-- Antes, si se aplicó 092_avisos_plaza_cron.sql, ejecutar 092_avisos_plaza_cron_baja.sql.
-- ============================================================================
drop trigger if exists trg_detectar_plaza_liberada on public.clases;
drop trigger if exists trg_desactivar_aviso_al_reservar on public.reservas;

drop function if exists public.detectar_plaza_liberada();
drop function if exists public.desactivar_aviso_al_reservar();
drop function if exists public.procesar_episodios_plaza_pendientes();
drop function if exists public.procesar_episodio_plaza(uuid);
drop function if exists public.limpiar_avisos_plaza();
drop function if exists public.empujar_cola_notificaciones();
drop function if exists public.activar_aviso_plaza(uuid);
drop function if exists public.desactivar_aviso_plaza(uuid);
drop function if exists public.mis_avisos_plaza();
drop function if exists public.sesion_ya_empezo(date, time);

drop table if exists public.avisos_plaza_enviados;
drop table if exists public.episodios_plaza;
drop table if exists public.alertas_plaza;

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
    when 'solicitud_valoracion' then
      v_categoria := 'solicitud_valoracion';
    when 'aviso_organizador' then
      v_categoria := 'avisos_organizador';
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
