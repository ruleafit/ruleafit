-- Reversión de 104. OJO: en un proyecto con los privilegios por defecto antiguos, la web dejaría de poder usar
-- estas tablas. Normalmente no hace falta revertir.
revoke select, insert, update, delete on
  public.archivo_fiscal,
  public.devoluciones,
  public.incidencias_pago,
  public.incidencias_pago_eventos,
  public.alertas_operativas,
  public.reprogramaciones,
  public.reprogramacion_respuestas
from service_role;
