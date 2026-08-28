-- 055_texto_motivo_bienvenida_ruleafit.sql
-- Rename Openfit -> Ruleafit: corrige la descripción del motivo de Open ya
-- insertado en open_motivos (sql/006_open_fidelizacion.sql). No toca saldos
-- ni esquema; el historial muestra la descripción actual del motivo, así que
-- esto también actualiza las filas de bienvenida ya existentes.

update public.open_motivos
set descripcion = 'Bienvenida al registrarse en Ruleafit'
where codigo = 'bienvenida';
