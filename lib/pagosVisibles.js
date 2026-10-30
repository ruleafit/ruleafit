// Los pagos online se muestran en la web solo cuando NEXT_PUBLIC_PAGOS_ACTIVOS
// es "true". El servidor tiene su propio interruptor (PAGOS_ACTIVOS y
// config_pagos.pagos_activos): este solo decide qué se enseña en pantalla.
export const PAGOS_VISIBLES = process.env.NEXT_PUBLIC_PAGOS_ACTIVOS === 'true'
