-- ============================================================================
-- Ruleafit · 064_clase_para_copiar.sql
-- Nueva función RPC clase_para_copiar(p_clase_id uuid), para el "Copiar
-- sesión" añadido el 21 de septiembre de 2026 (ver app/publicar/page.js,
-- app/mis-clases/page.js).
--
-- Bug corregido: al copiar una sesión ya CANCELADA POR EL ENTRENADOR, el
-- formulario de /publicar salía completamente vacío en vez de precargado.
-- No pasaba con sesiones activas, pasadas y confirmadas, ni con las
-- canceladas por no alcanzar el mínimo.
--
-- Causa raíz: app/publicar/page.js precargaba los datos con una consulta
-- directa `supabase.from('clases').select(...).eq('id', copiarId)`, sujeta
-- a la política RLS "Ver clases activas" (sql/009_ver_clase_cancelada_propia.sql):
-- using (estado = 'activa' or existe una reserva propia del usuario que
-- consulta sobre esa clase). Cuando el entrenador cancela su propia clase
-- (cancelar_clase(), sql/007_minimo_y_cancelar_clase.sql) esta pasa a
-- estado = 'cancelada' para siempre, y el entrenador nunca tiene una
-- "reserva propia" sobre su propia clase (no puede reservarse a sí mismo
-- desde la unificación de roles, sql/060), así que esa condición nunca se
-- cumple y la consulta no devuelve la fila -> formulario vacío.
--
-- Las sesiones "no alcanzó el mínimo" parecían funcionar por una razón
-- distinta y no relacionada con el motivo de cancelación: cuando la vista de
-- la tarjeta muestra el aviso "No se alcanzó el mínimo" (en vez de "Sesión
-- cancelada"), es porque esa clase, en la práctica, puede seguir teniendo
-- estado = 'activa' en la base de datos (ver app/mis-clases/page.js,
-- renderTarjeta: ese aviso solo aparece cuando clase.estado !== 'cancelada'),
-- así que sí cumple la condición "estado = 'activa'" de la política y la
-- consulta directa funcionaba por casualidad, no por diseño.
--
-- Solución: igual que mis_clases() (sql/011_panel_entrenador_y_contador.sql,
-- redefinida en sql/060) ya hace para listar clases propias sea cual sea su
-- estado, esta función es SECURITY DEFINER y comprueba trainer_id =
-- auth.uid() ella misma en vez de depender de la política RLS de lectura
-- pública, así que también funciona con clases canceladas por el
-- entrenador.
--
-- Depende de sql/016_tabla_clases.sql (tabla public.clases).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Función RPC clase_para_copiar(p_clase_id uuid)
-- Devuelve los campos necesarios para precargar el formulario de "Publicar
-- sesión" al copiar una sesión ya publicada, sea cual sea su estado -
-- siempre que pertenezca al usuario autenticado. Si la clase no existe o no
-- es suya, no devuelve ninguna fila (sin lanzar excepción), igual que hacía
-- antes el .maybeSingle() de la consulta directa.
-- ----------------------------------------------------------------------------
create or replace function public.clase_para_copiar(p_clase_id uuid)
returns table (
  titulo           public.clases.titulo%type,
  categoria        public.clases.categoria%type,
  tipo_actividad   public.clases.tipo_actividad%type,
  ciudad           public.clases.ciudad%type,
  direccion        public.clases.direccion%type,
  punto_encuentro  public.clases.punto_encuentro%type,
  fecha            public.clases.fecha%type,
  hora             public.clases.hora%type,
  duracion         public.clases.duracion%type,
  nivel            public.clases.nivel%type,
  precio           public.clases.precio%type,
  plazas_max       public.clases.plazas_max%type,
  plazas_min       public.clases.plazas_min%type,
  material         public.clases.material%type,
  observaciones    public.clases.observaciones%type,
  lat              public.clases.lat%type,
  lng              public.clases.lng%type
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null then
    raise exception 'Debes iniciar sesión.' using errcode = '28000';
  end if;

  return query
    select
      c.titulo,
      c.categoria,
      c.tipo_actividad,
      c.ciudad,
      c.direccion,
      c.punto_encuentro,
      c.fecha,
      c.hora,
      c.duracion,
      c.nivel,
      c.precio,
      c.plazas_max,
      c.plazas_min,
      c.material,
      c.observaciones,
      c.lat,
      c.lng
    from public.clases c
    where c.id = p_clase_id
      and c.trainer_id = v_usuario_id;
end;
$$;

comment on function public.clase_para_copiar(uuid) is
  'Devuelve los datos de una clase propia (sea cual sea su estado, incluida cancelada) para precargar el formulario de "Copiar sesión". SECURITY DEFINER para poder leer clases propias que la política RLS de lectura pública ("Ver clases activas") no dejaría ver si están canceladas; comprueba trainer_id = auth.uid() ella misma. No devuelve ninguna fila si la clase no existe o no pertenece al usuario autenticado.';

revoke all on function public.clase_para_copiar(uuid) from public;
grant execute on function public.clase_para_copiar(uuid) to authenticated;
