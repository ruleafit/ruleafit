-- 045_generar_notificacion.sql
-- Funcion helper unica para generar notificaciones. Hace DOS cosas:
--   1. SIEMPRE inserta en notificaciones_historial (queda constancia).
--   2. Encola en notificaciones_cola (push) SOLO si la preferencia de la
--      categoria del tipo esta activa. Las categorias criticas siempre pasan.
-- Mapeo tipo -> categoria y criticidad centralizado aqui.

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
  -- 1. Mapear el tipo concreto a su categoria y marcar si es critica.
  --    Categorias: 'publicaciones', 'reservas', 'entrenador'.
  --    Criticas (siempre push, no desactivables): las cancelaciones.
  case p_tipo
    when 'sesion_publicada' then
      v_categoria := 'publicaciones';
    when 'recordatorio_sesion_24h', 'recordatorio_sesion_7h', 'recordatorio_sesion_2h' then
      v_categoria := 'reservas';
    when 'plazas_agotadas',
         'recordatorio_sesion_24h_entrenador',
         'recordatorio_sesion_7h_entrenador',
         'recordatorio_sesion_2h_entrenador' then
      v_categoria := 'entrenador';
    when 'sesion_cancelada', 'sesion_cancelada_minimo', 'sesion_cancelada_minimo_entrenador' then
      v_categoria := 'criticas';
      v_critica := true;
    else
      -- Tipo desconocido: por seguridad se trata como critico (se envia).
      v_categoria := 'otras';
      v_critica := true;
  end case;

  -- 2. Historial SIEMPRE (envuelto para que un fallo no rompa nada).
  begin
    insert into notificaciones_historial (usuario_id, tipo, titulo, cuerpo, url)
    values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
  exception when others then null; end;

  -- 3. Decidir si encolar push. Opt-out: sin fila = activa.
  if v_critica then
    v_activa := true;
  else
    select coalesce(
      (select activo from preferencias_notificaciones
        where usuario_id = p_usuario_id and categoria = v_categoria),
      true
    ) into v_activa;
  end if;

  -- 4. Encolar push solo si procede (envuelto igual).
  if v_activa then
    begin
      insert into notificaciones_cola (usuario_id, tipo, titulo, cuerpo, url)
      values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, p_url);
    exception when others then null; end;
  end if;
end;
$$;
