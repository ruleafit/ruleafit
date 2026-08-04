-- 027_texto_motivo_asistencia_sesion.sql
-- Unifica terminología en la descripción del motivo de Open (no toca saldos ni esquema).
-- El historial muestra la descripción actual del motivo, así que esto también
-- actualiza las filas de asistencia ya existentes.

update public.open_motivos
set descripcion = 'Asistencia confirmada por el entrenador a una sesión reservada'
where codigo = 'asistencia_confirmada';
