-- 050_generar_notificacion_v2.sql
-- Reemplaza generar_notificacion (sql/045) con un mapeo tipo->categoria mas
-- granular: cada recordatorio tiene su propia categoria (para poder activarlos
-- o desactivarlos por separado desde el panel). Las cancelaciones siguen siendo
-- criticas (siempre push). El historial se sigue guardando SIEMPRE.
--
-- Categorias desactivables (opt-out, ausencia de fila = activo):
--   publicaciones
--   recordatorio_24h, recordatorio_7h, recordatorio_2h            (cliente)
--   recordatorio_24h_entrenador, recordatorio_7h_entrenador,
--   recordatorio_2h_entrenador                                    (entrenador)
--   plazas_agotadas                                               (entrenador)
-- Criticas (siempre push): sesion_cancelada, sesion_cancelada_minimo,
--   sesion_cancelada_minimo_entrenador.

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
  -- Mapear tipo -> categoria. Para la mayoria, la categoria es el propio tipo.
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
    when 'plazas_agotadas' then
      v_categoria := 'plazas_agotadas';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      -- Tipo desconocido: por seguridad se envia (critico).
      v_categoria := 'otras';
      v_critica := true;
  end case;

  -- Historial SIEMPRE.
  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  -- Decidir push. Opt-out: sin fila = activa.
  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  -- Encolar push solo si procede.
  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;
