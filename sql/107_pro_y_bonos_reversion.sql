-- ============================================================================
-- Reversión de 107. Con los pagos APAGADOS. No borra tablas ni columnas (pueden tener dinero registrado).
-- Después hay que ejecutar, en este orden: sql/105_ingresos_retencion.sql y sql/106_bonos_con_pagos.sql, y volver
-- a crear abrir_incidencia_cobro() con el bloque correspondiente de sql/103_blindaje_cobros.sql.
-- 105 vuelve a crear devolver_y_cerrar_incidencia(), liberar_pendientes(), cobro_retenido() y mis_ingresos().
-- ============================================================================
do $$
begin
  if exists (select 1 from public.config_pagos where id and pagos_activos) then
    raise exception 'Apaga los pagos antes de revertir 107.';
  end if;
  if exists (select 1 from public.cobros where estado = 'reembolsado_parcial' or tipo = 'bono') then
    raise exception 'Hay cobros de bonos: no se puede revertir sin revisarlos a mano.';
  end if;
end;
$$;

drop trigger if exists trg_validar_bono on public.bonos;
drop trigger if exists trg_impedir_bono_sin_pago on public.bonos_clientes;
drop trigger if exists trg_devolver_bonos_por_bloqueo on public.bloqueos;
drop trigger if exists trg_contar_cancelacion_con_bono on public.reservas;

drop function if exists public.confirmar_cobro_pagado(text, integer, boolean, text, text);
alter function public.confirmar_cobro_sesion(text, integer, boolean, text, text) rename to confirmar_cobro_pagado;
drop function if exists public.reclamar_devolucion();
alter function public.reclamar_devolucion_cobro() rename to reclamar_devolucion;
drop function if exists public.completar_devolucion(uuid, boolean, text, text);
alter function public.completar_devolucion_cobro(uuid, boolean, text, text) rename to completar_devolucion;
drop function if exists public.devolver_y_cerrar_incidencia(uuid, text);
alter function public.devolver_y_cerrar_sesion(uuid, text) rename to devolver_y_cerrar_incidencia;
drop function if exists public.eliminar_mi_cuenta();
alter function public.eliminar_mi_cuenta_base() rename to eliminar_mi_cuenta;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

drop function if exists public.validar_bono(), public.impedir_bono_sin_pago(), public.devolver_bonos_por_bloqueo(),
  public.contar_cancelacion_con_bono(), public.bonos_a_la_venta(uuid), public.crear_cobro_bono(uuid, text, text),
  public.solicitar_devolucion_bono(uuid), public.cancelar_bono_vendido(uuid), public.cancelar_mis_bonos(),
  public.devolver_bonos_de_organizador(uuid, text), public.levantar_retencion_bonos(uuid),
  public.cotizar_devolucion_bono(uuid), public.devolver_bono(uuid, text), public.bono_usadas(uuid),
  public.crear_pago_pro(text), public.confirmar_pago_pro(text, integer, boolean, text, text, text),
  public.cancelar_pro(), public.reactivar_pro(), public.desistir_pro(), public.cotizar_desistimiento_pro(uuid),
  public.reclamar_renovacion_pro(text), public.marcar_pago_pro_dudoso(text), public.mi_pro(),
  public.mis_bonos_estado(), public.mis_bonos_vendidos_estado(), public.puede_vender_bonos(uuid), public.pro_activo(uuid);
