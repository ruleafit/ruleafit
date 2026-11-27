-- ============================================================================
-- Ruleafit · 107_pro_y_bonos_preactivacion.sql
-- PRODUCCIÓN: ejecutar justo antes de activar los pagos, después de 107.
-- Regla: no queda ningún bono anterior a la venta online a la venta. Se DESACTIVAN (no se borran) y los ya
-- adquiridos se siguen usando hasta agotarse o caducar. El 27/11/2026 había 3 bonos y 1 adquirido.
-- ============================================================================
-- 1) Mirar antes:
select b.id, b.activo, b.numero_sesiones, b.precio, count(bc.id) as adquiridos, max(bc.fecha_fin) as caduca_el_ultimo
  from public.bonos b left join public.bonos_clientes bc on bc.bono_id = b.id
 where b.reglas_version is distinct from 2
 group by b.id order by b.created_at;

-- 2) Desactivar:
update public.bonos set activo = false where reglas_version is distinct from 2 and activo;
