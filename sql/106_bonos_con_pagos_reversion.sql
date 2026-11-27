-- Reversión de 106. Atención: con los pagos activos vuelve a poder adquirirse un bono sin pagar.
drop trigger if exists trg_impedir_bono_con_pagos on public.bonos_clientes;
drop function if exists public.impedir_bono_con_pagos();
