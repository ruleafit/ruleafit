-- ============================================================================
-- Ruleafit · 104_permisos_explicitos.sql
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
